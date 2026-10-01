#!/usr/bin/env python3
"""jevslop: an AI-slop detector built on TypeSafe's Jev.

    export TYPESAFE_API_KEY=...
    python jevslop.py essay.txt          # or: cat essay.txt | python jevslop.py
    python jevslop.py essay.txt --json   # machine-readable result
    python jevslop.py essay.txt --dry-run  # code-measured tells only, no API call
"""

import argparse
import asyncio
import json
import sys

from tells import (
    CODE_TELLS, DOCUMENT_SCORES, DOCUMENT_TELLS, GUT_CHECK, MIN_PARAGRAPH_WORDS,
    PARAGRAPH_TELLS, VERDICTS, YES, JevTell, ScoreTell,
)
from textstats import measure, paragraphs, words

# Jev's budget is 32k tokens for state plus the longest question. Leave room.
MAX_DOCUMENT_WORDS = 18000
MAX_CONCURRENT_REQUESTS = 8
# jev-1.13 list price: input tokens only, output is free.
USD_PER_MILLION_INPUT_TOKENS = 0.042


def _noul(tell: JevTell):
    from typesafe_sdk import Noul
    return Noul(
        instructions=tell.instructions,
        criteria={"true": tell.true, "false": tell.false},
    )


def _score(tell: ScoreTell):
    from typesafe_sdk import Score
    return Score(instructions=tell.instructions, criteria=tell.levels)


async def ask_jev(text: str, model: str | None) -> dict:
    from typesafe_sdk import AsyncTypeSafeClient

    paras = paragraphs(text)
    eligible = [i for i, p in enumerate(paras) if len(words(p)) >= MIN_PARAGRAPH_WORDS]

    doc_words = words(text)
    truncated = len(doc_words) > MAX_DOCUMENT_WORDS
    doc_text = text
    if truncated:
        # Cut at the paragraph boundary before the word limit.
        kept, count = [], 0
        for p in paras:
            count += len(words(p))
            if count > MAX_DOCUMENT_WORDS:
                break
            kept.append(p)
        doc_text = "\n\n".join(kept)

    doc_questions = {t.id: _noul(t) for t in DOCUMENT_TELLS}
    doc_questions |= {t.id: _score(t) for t in DOCUMENT_SCORES + [GUT_CHECK]}
    para_questions = {t.id: _noul(t) for t in PARAGRAPH_TELLS}

    sem = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    usage = {"input_tokens": 0, "requests": 0}

    async with AsyncTypeSafeClient(model=model) as client:
        async def call(state, questions):
            async with sem:
                r = await client.system_one(state=state, questions=questions)
            usage["input_tokens"] += r.usage.input_tokens or 0
            usage["requests"] += 1
            return r

        doc_task = call({"text": doc_text}, doc_questions)
        para_tasks = [call({"paragraph": paras[i]}, para_questions) for i in eligible]
        doc, *para_results = await asyncio.gather(doc_task, *para_tasks)

    return {
        "model": doc.model,
        "truncated": truncated,
        "paragraphs": paras,
        "eligible": eligible,
        "doc_nouls": {t.id: doc.nouls[t.id].noul for t in DOCUMENT_TELLS},
        "doc_scores": {
            t.id: doc.scores[t.id].score for t in DOCUMENT_SCORES + [GUT_CHECK]
        },
        "para_nouls": [
            {t.id: r.nouls[t.id].noul for t in PARAGRAPH_TELLS} for r in para_results
        ],
        "usage": usage,
    }


def analyse(stats: dict, jev: dict | None) -> dict:
    """Turn raw measurements into per-tell strengths (0-1) and a 0-100 score."""
    tells = []

    for t in CODE_TELLS:
        m = stats[t.id]
        tells.append({"id": t.id, "name": t.name, "kind": "code", "weight": t.weight,
                      "strength": m["strength"], "detail": m, "unit": t.unit})

    if jev:
        for t in DOCUMENT_TELLS:
            p = jev["doc_nouls"][t.id]
            tells.append({"id": t.id, "name": t.name, "kind": "document",
                          "weight": t.weight, "strength": p})
        for t in DOCUMENT_SCORES + [GUT_CHECK]:
            s = jev["doc_scores"][t.id]
            tells.append({"id": t.id, "name": t.name, "kind": "document",
                          "weight": t.weight, "strength": s / (len(t.levels) - 1)})
        n = len(jev["para_nouls"])
        for t in PARAGRAPH_TELLS:
            hits = [jev["eligible"][k] for k, a in enumerate(jev["para_nouls"])
                    if a[t.id] > YES]
            tells.append({"id": t.id, "name": t.name, "kind": "paragraph",
                          "weight": t.weight,
                          "strength": len(hits) / n if n else None,
                          "paragraphs": hits})

    scored = [t for t in tells if t["strength"] is not None and t["weight"] > 0]
    total_w = sum(t["weight"] for t in scored)
    score = 100 * sum(t["weight"] * t["strength"] for t in scored) / total_w if total_w else 0
    verdict = next(label for cutoff, label in VERDICTS if score < cutoff)

    result = {"score": round(score, 1), "verdict": verdict, "tells": tells}
    if jev:
        g = jev["doc_scores"][GUT_CHECK.id]
        result["gut_check"] = {"score": g, "label": GUT_CHECK.levels[round(g)]}
        result["model"] = jev["model"]
        result["usage"] = jev["usage"]
        result["truncated"] = jev["truncated"]
        # Per-paragraph slop: mean Noul across paragraph tells.
        result["paragraph_scores"] = [
            {"index": i, "mean": sum(a.values()) / len(a),
             "tells": [t.id for t in PARAGRAPH_TELLS if a[t.id] > YES]}
            for i, a in zip(jev["eligible"], jev["para_nouls"])
        ]
    return result


def _bar(x: float, width: int = 20) -> str:
    n = round(x * width)
    return "█" * n + "·" * (width - n)


def print_answers(jev: dict) -> None:
    """Print every question Jev was asked and its raw answer."""
    print("\nJev's raw answers, whole text:")
    for t in DOCUMENT_TELLS:
        print(f"  {jev['doc_nouls'][t.id]:5.2f}  noul   {t.name}")
    for t in DOCUMENT_SCORES + [GUT_CHECK]:
        s = jev["doc_scores"][t.id]
        print(f"  {s:5.2f}  score  {t.name} (0-{len(t.levels) - 1}: "
              f"{t.levels[round(s)]})")
    print("\nJev's raw answers per paragraph (noul = probability the tell is present):")
    header = " ".join(f"{t.id[:9]:>9}" for t in PARAGRAPH_TELLS)
    print(f"  {'':>4} {header}")
    for i, answers in zip(jev["eligible"], jev["para_nouls"]):
        row = " ".join(f"{answers[t.id]:9.2f}" for t in PARAGRAPH_TELLS)
        print(f"  ¶{i + 1:<3} {row}")
    skipped = len(jev["paragraphs"]) - len(jev["eligible"])
    if skipped:
        print(f"  ({skipped} paragraphs under {MIN_PARAGRAPH_WORDS} words not asked)")


def print_report(result: dict, paras: list[str]) -> None:
    print(f"\njevslop score: {result['score']:.0f}/100 — {result['verdict']}")
    if "gut_check" in result:
        g = result["gut_check"]
        print(f"Jev's gut check: {g['label']} ({g['score']:.2f} on 0-3)")
    if result.get("truncated"):
        print(f"(document-level checks saw only the first ~{MAX_DOCUMENT_WORDS} words)")

    ordered = sorted(result["tells"], key=lambda t: -(t["strength"] or 0))
    print("\nTells, strongest first:")
    for t in ordered:
        if t["strength"] is None:
            print(f"  {'(text too short)':>22}  {t['name']}")
            continue
        extra = ""
        if t["kind"] == "paragraph" and t["paragraphs"]:
            extra = "  ¶ " + ", ".join(str(i + 1) for i in t["paragraphs"])
        if t["id"] == "stock_vocab" and t["detail"]["hits"]:
            top = sorted(t["detail"]["hits"].items(), key=lambda kv: -kv[1])[:6]
            extra = "  " + ", ".join(f"{w}×{n}" for w, n in top)
        elif t["kind"] == "code" and t["detail"]["value"] is not None:
            extra = f"  ({t['detail']['value']:.2f} {t['unit']})"
        print(f"  {_bar(t['strength'])} {t['strength']:4.2f}  {t['name']}{extra}")

    worst = sorted(result.get("paragraph_scores", []), key=lambda p: -p["mean"])[:3]
    worst = [p for p in worst if p["tells"]]
    if worst:
        print("\nSloppiest paragraphs:")
        for p in worst:
            snippet = " ".join(paras[p["index"]].split())
            snippet = snippet[:110] + ("…" if len(snippet) > 110 else "")
            print(f"  ¶{p['index'] + 1} [{', '.join(p['tells'])}]\n     {snippet}")

    if "usage" in result:
        tokens = result["usage"]["input_tokens"]
        cost = tokens * USD_PER_MILLION_INPUT_TOKENS / 1e6
        print(f"\n{result['model']}, {result['usage']['requests']} requests, "
              f"{tokens} input tokens ≈ ${cost:.6f}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("file", nargs="?", help="text file to check (default: stdin)")
    ap.add_argument("--json", action="store_true", help="print the result as JSON")
    ap.add_argument("--answers", action="store_true",
                    help="also print Jev's raw answer to every question")
    ap.add_argument("--dry-run", action="store_true",
                    help="only run the code-measured tells; don't call Jev")
    ap.add_argument("--model", default=None, help="Jev model (default: jev-latest)")
    args = ap.parse_args()

    text = open(args.file, encoding="utf-8").read() if args.file else sys.stdin.read()
    if not words(text):
        print("No text to check.", file=sys.stderr)
        return 2

    jev = None if args.dry_run else asyncio.run(ask_jev(text, args.model))
    result = analyse(measure(text), jev)

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        if args.answers and jev:
            print_answers(jev)
        print_report(result, paragraphs(text))
    return 0


if __name__ == "__main__":
    sys.exit(main())
