"""Step 2b: score Vev's answers against the game's true state.

For yes/no questions: accuracy at 0.5, Brier score, and AUC (how well the
probability ranks yes above no, independent of any threshold). For multiple
choice: accuracy of the top option. For scores: mean absolute error in levels.
"Base" is what you'd get by always giving the most common true answer, so a
question is only useful as a feature if Vev clearly beats it.

    python evaluate.py data/bollard-hop --game bollard-hop
"""

import argparse
import collections
import json
from pathlib import Path

from questions import battery


def auc(pos, neg):
    if not pos or not neg:
        return None
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("--game", default=None)
    ap.add_argument("--answers", default="vev_answers.jsonl")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    data = Path(args.data)
    truth = {s["id"]: s["truth"] for s in map(json.loads, (data / "samples.jsonl").open())}
    rows = [json.loads(l) for l in (data / args.answers).open()]
    questions = battery(args.game)

    report = {}
    for qid, q in questions.items():
        pairs = [(truth[r["id"]][qid], r["answers"][qid]) for r in rows if truth[r["id"]].get(qid) is not None]
        if not pairs:
            continue
        t = [p[0] for p in pairs]
        base = collections.Counter(t).most_common(1)[0][1] / len(t)
        if q.type == "noul":
            p = [a["noul"] for _, a in pairs]
            acc = sum((pi > 0.5) == bool(ti) for pi, ti in zip(p, t)) / len(t)
            brier = sum((pi - ti) ** 2 for pi, ti in zip(p, t)) / len(t)
            a = auc([pi for pi, ti in zip(p, t) if ti], [pi for pi, ti in zip(p, t) if not ti])
            report[qid] = {"type": "noul", "n": len(t), "acc": acc, "base": base, "auc": a, "brier": brier}
        elif q.type == "choice":
            acc = sum(a["choice"] == ti for ti, a in pairs) / len(t)
            confusion = collections.Counter((ti, a["choice"]) for ti, a in pairs)
            report[qid] = {"type": "choice", "n": len(t), "acc": acc, "base": base,
                           "top_errors": [f"{k[0]}→{k[1]}: {v}" for k, v in confusion.most_common() if k[0] != k[1]][:3]}
        else:
            mae = sum(abs(a["score"] - ti) for ti, a in pairs) / len(t)
            acc = sum(round(a["score"]) == ti for ti, a in pairs) / len(t)
            report[qid] = {"type": "score", "n": len(t), "acc": acc, "base": base, "mae": mae}

    if args.json:
        print(json.dumps(report, indent=2))
        return
    secs = [r["seconds"] for r in rows]
    print(f"{len(rows)} samples labelled, {sum(secs) / len(secs):.1f} s per sample on average\n")
    print(f"{'question':18} {'type':6} {'n':>4} {'acc':>5} {'base':>5} {'AUC':>5}  notes")
    for qid, m in report.items():
        auc_s = f"{m['auc']:.2f}" if m.get("auc") is not None else "  -  "
        note = (f"Brier {m['brier']:.3f}" if m["type"] == "noul" else
                f"MAE {m['mae']:.2f} levels" if m["type"] == "score" else "; ".join(m["top_errors"]))
        print(f"{qid:18} {m['type']:6} {m['n']:4} {m['acc']:5.2f} {m['base']:5.2f} {auc_s:>5}  {note}")


if __name__ == "__main__":
    main()
