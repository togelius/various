"""Tells measured in plain Python: anything that is counting or arithmetic."""

import re
import statistics

from tells import CODE_TELLS, STOCK_PHRASES

_WORD = re.compile(r"[A-Za-z0-9'’-]+")
_SENTENCE_END = re.compile(r"(?<=[.!?])[\"'”’)]*\s+(?=[\"'“‘(]*[A-Z0-9])")
_BOLD_LABEL = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+\*\*[^*]{1,60}?:?\*\*:?")
_EMOJI = re.compile(
    "^\\s*(?:[-*•#]+\\s*)?[\U0001F300-\U0001FAFF☀-➿⭐✅❌]"
)
_STOCK = [
    re.compile(r"(?<![\w-])" + re.escape(p).replace("'", "['’]") + r"(?![\w-])", re.I)
    for p in STOCK_PHRASES
]


def paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def words(text: str) -> list[str]:
    return _WORD.findall(text)


def sentences(text: str) -> list[str]:
    # Ignore headings and list items: their lengths say nothing about prose rhythm.
    prose = [
        p for p in paragraphs(text)
        if not re.match(r"^\s*(#|[-*•]\s|\d+[.)]\s)", p)
    ]
    out = []
    for p in prose:
        out += [s for s in _SENTENCE_END.split(" ".join(p.split())) if words(s)]
    return out


def _cv(values: list[int]) -> float | None:
    if len(values) < 2 or statistics.mean(values) == 0:
        return None
    return statistics.pstdev(values) / statistics.mean(values)


def _ramp(value: float, lo: float, hi: float) -> float:
    t = (value - lo) / (hi - lo)
    return max(0.0, min(1.0, t))


def measure(text: str) -> dict[str, dict]:
    """Return {tell_id: {"value": float|None, "strength": float|None, ...}}.

    strength is None when the text is too short for the measure to mean
    anything; such tells are left out of the composite score.
    """
    n_words = max(1, len(words(text)))
    per_k = 1000 / n_words
    lines = text.splitlines()

    stock_hits: dict[str, int] = {}
    for phrase, rx in zip(STOCK_PHRASES, _STOCK):
        n = len(rx.findall(text))
        if n:
            stock_hits[phrase] = n

    sent_lengths = [len(words(s)) for s in sentences(text)]
    para_lengths = [len(words(p)) for p in paragraphs(text)]

    raw = {
        "stock_vocab": (sum(stock_hits.values()) * per_k, n_words >= 150,
                        {"hits": stock_hits}),
        "em_dash": (text.count("—") * per_k, n_words >= 150,
                    {"count": text.count("—")}),
        "low_burstiness": (_cv(sent_lengths), len(sent_lengths) >= 8,
                           {"sentences": len(sent_lengths)}),
        "uniform_paragraphs": (_cv(para_lengths), len(para_lengths) >= 4,
                               {"paragraphs": len(para_lengths)}),
        "bold_labels": (float(sum(bool(_BOLD_LABEL.match(l)) for l in lines)), True, {}),
        "emoji_bullets": (float(sum(bool(_EMOJI.match(l)) for l in lines)), True, {}),
    }

    out = {}
    for tell in CODE_TELLS:
        value, enough, extra = raw[tell.id]
        strength = (
            _ramp(value, tell.lo, tell.hi) if enough and value is not None else None
        )
        out[tell.id] = {"value": value, "strength": strength, **extra}
    return out
