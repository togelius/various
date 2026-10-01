# jevslop

An AI-slop detector built on [Jev](https://docs.typesafe.ai/), TypeSafe's
System One model. Jev doesn't generate text; it answers typed questions
about a text with calibrated probabilities. jevslop asks it about a list of
specific tells of AI writing, measures a few more in plain Python, and
combines them into a 0–100 score with an itemised report.

It is a detector of *style*, not of provenance. A human who writes like a
press release will score high, and an AI-written text that has been edited
with care will score low. Treat the score as "how much this reads like
default chatbot prose", not as proof of anything.

## Usage

```sh
pip install -r requirements.txt
export TYPESAFE_API_KEY=...            # from https://console.typesafe.ai/keys

python jevslop.py essay.txt
cat essay.txt | python jevslop.py
python jevslop.py essay.txt --json     # full result as JSON
python jevslop.py essay.txt --dry-run  # code-measured tells only, no API key needed
```

Try it on `samples/slop.txt` and `samples/human.txt`.

## The tells

All questions, weights and thresholds are in [`tells.py`](tells.py).

### Asked of each paragraph (Jev)

Each paragraph of 12+ words is sent to Jev in its own request. A tell's
strength is the share of paragraphs that show it, and the report lists the
paragraphs.

| Tell | Example |
| --- | --- |
| “Not X, but Y” reframing | “It's not just a trend — it's a transformation.” |
| Inflated significance | “stands as a testament to”, “plays a pivotal role” |
| Tacked-on “-ing” commentary | “…, highlighting the importance of collaboration.” |
| Reflexive rule of three | “fast, reliable, and secure” |
| Signposting and throat-clearing | “Let's dive in.” “It's worth noting that…” |
| Vague attribution | “Experts say…”, “Studies show…” |
| Self-answered rhetorical question | “The result? A faster app.” |
| Generic filler | Abstract claims that would fit an essay on any topic |

### Asked of the whole text (Jev)

| Tell | Example |
| --- | --- |
| Scene-setting opener | “In today's fast-paced digital landscape…” |
| Recap conclusion | “In conclusion, …” restating what was said |
| Chatbot residue | “Certainly!”, “I hope this helps”, “Let me know if…” |
| Fence-sitting balance | Both sides laid out, no position taken |
| Brochure tone | “vibrant”, “seamless”, “nestled”, “rich tapestry” |
| Absent personal voice (Score) | No opinions, experience, humour or odd word choices |

Jev also gives an overall gut-check Score (“how closely does this resemble
default chatbot prose?”). It is shown in the report but left out of the
composite, so the composite is built only from tells you can inspect.

### Measured in code

Jev's own documentation says it cannot count reliably, so anything that is a
matter of frequency is done in Python:

| Tell | Measure |
| --- | --- |
| Stock AI vocabulary | “delve”, “tapestry”, “pivotal”, “leverage”, “in today's”… per 1,000 words |
| Em-dash habit | em dashes per 1,000 words |
| Uniform sentence length | low variation (“burstiness”) in sentence length |
| Uniform paragraph length | low variation in paragraph length |
| Bold-label bullet lists | lines like `- **Scalability:** …` |
| Emoji bullets/headings | lines starting with ✅, 🚀, etc. |

Code-measured tells that need more text than they get (e.g. burstiness on a
three-sentence text) are skipped rather than guessed.

## Scoring

Each tell gets a strength from 0 to 1 and a weight. The score is the weighted
mean × 100: under 25 “probably human”, 25–45 “a few tells”, 45–65
“suspicious”, 65+ “slop”. **The weights and thresholds are hand-picked and
not yet calibrated.** Run it over texts whose origin you know and adjust
`tells.py`.

## Cost

One request for the whole text plus one per paragraph, sent concurrently.
Jev charges only for input tokens ($0.042 per million), so checking a
1,000-word essay costs a small fraction of a cent.
