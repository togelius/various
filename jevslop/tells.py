"""The tells of AI writing that jevslop looks for, and every threshold it uses.

All questions, weights and thresholds live in this one file so they are easy
to review and tune. Weights are hand-picked starting points, not calibrated:
run jevslop over texts you know the provenance of and adjust.

There are three kinds of tell:

* PARAGRAPH_TELLS are asked of each paragraph separately (one Jev request per
  paragraph, all Nouls). A tell's strength is the fraction of paragraphs that
  show it, so the report can point at the offending paragraphs.
* DOCUMENT_TELLS are asked once of the whole text.
* CODE_TELLS are measured in Python. Jev does not count reliably, so anything
  that is a matter of frequency or arithmetic is done here instead.
"""

from dataclasses import dataclass, field

# A Noul above this counts as "the tell is present".
YES = 0.5

# Paragraphs shorter than this (in words) are skipped for paragraph tells;
# they are usually headings, list items or sign-offs.
MIN_PARAGRAPH_WORDS = 12

# Composite score bands (0-100). The composite is a weighted mean over tells
# that rarely all co-occur (an essay won't have emoji bullets or chatbot
# residue), so even blatant slop lands around 50-60.
VERDICTS = [
    (15, "probably human"),
    (30, "a few tells"),
    (45, "suspicious"),
    (101, "slop"),
]


@dataclass
class JevTell:
    id: str
    name: str
    weight: float
    instructions: str
    true: str
    false: str


@dataclass
class ScoreTell:
    id: str
    name: str
    weight: float
    instructions: str
    # Ordered from least to most slop-like.
    levels: list[str] = field(default_factory=list)


@dataclass
class CodeTell:
    id: str
    name: str
    weight: float
    # Metric value at which the tell starts to count (strength 0) and at which
    # it counts fully (strength 1). Linear in between. lo > hi means a low
    # value is the tell.
    lo: float
    hi: float
    unit: str


PARAGRAPH_TELLS = [
    JevTell(
        "contrast_reframe",
        "“Not X, but Y” reframing",
        1.5,
        "Does `paragraph` contain a sentence that denies a claim nobody made in "
        "order to state the real point, such as “It's not just X, it's Y”, "
        "“This isn't about X. It's about Y.” or “X is not merely A but B”?",
        "At least one sentence uses the deny-then-reveal construction.",
        "No sentence sets up and knocks down an unstated claim.",
    ),
    JevTell(
        "inflated_significance",
        "Inflated significance",
        1.2,
        "Does `paragraph` describe something as important, pivotal, "
        "transformative, a testament, a turning point, or as reshaping its "
        "field, without giving concrete evidence for that importance?",
        "Grand claims of significance with no supporting specifics, e.g. "
        "“stands as a testament to”, “plays a pivotal role in”, “marks a "
        "significant shift”.",
        "Importance is either not claimed or is backed up by specifics.",
    ),
    JevTell(
        "trailing_participle",
        "Tacked-on “-ing” commentary",
        1.0,
        "Does a sentence in `paragraph` end with a comma followed by a phrase "
        "starting with an -ing verb that comments on the meaning of what was "
        "just said, such as “, highlighting the importance of X”, "
        "“, underscoring its role in Y” or “, reflecting a broader trend”?",
        "At least one sentence ends with an evaluative -ing tail.",
        "No sentence ends with an evaluative -ing tail.",
    ),
    JevTell(
        "triplet",
        "Reflexive rule of three",
        0.8,
        "Does `paragraph` use a list of three parallel words or phrases for "
        "rhythm, where the three items are near-synonyms or vague qualities "
        "rather than three distinct, concrete things, as in “fast, reliable, "
        "and secure” or “innovation, collaboration, and growth”?",
        "Contains a rhythmic triplet of vague or overlapping items.",
        "No such triplet; any lists name distinct concrete things.",
    ),
    JevTell(
        "signposting",
        "Signposting and throat-clearing",
        1.0,
        "Does `paragraph` contain a phrase that announces what the text is "
        "about to do or that something deserves attention, instead of just "
        "saying it, such as “Let's dive in”, “It's worth noting that”, "
        "“Here's the thing”, “It is important to remember that” or "
        "“Let's break it down”?",
        "Contains at least one announcing or throat-clearing phrase.",
        "Gets straight to the point.",
    ),
    JevTell(
        "vague_attribution",
        "Vague attribution",
        1.0,
        "Does `paragraph` attribute a claim to an unnamed authority, such as "
        "“experts say”, “studies show”, “many believe”, “research suggests” or "
        "“critics argue”, without naming who or what?",
        "Cites unnamed experts, studies or groups.",
        "Claims are either unattributed or attributed to a named source.",
    ),
    JevTell(
        "rhetorical_qa",
        "Self-answered rhetorical question",
        0.8,
        "Does `paragraph` ask a short question and immediately answer it "
        "itself, as in “The result? A faster app.” or “Why does this matter? "
        "Because…”?",
        "Contains a question that the text answers in the next breath.",
        "No self-answered question.",
    ),
    JevTell(
        "generic_filler",
        "Generic filler",
        1.5,
        "Does `paragraph` consist mostly of abstract statements that could be "
        "pasted into a text on a different topic without seeming out of "
        "place, with no specific names, numbers, places, dates, events, "
        "quotations or examples?",
        "Mostly interchangeable generalities with nothing concrete.",
        "Anchored in concrete, topic-specific details.",
    ),
]


DOCUMENT_TELLS = [
    JevTell(
        "generic_opener",
        "Scene-setting opener",
        1.0,
        "Does the first sentence of `text` open with a broad statement about "
        "the world, the present era or a whole field, such as “In today's "
        "fast-paced digital landscape”, “Throughout history” or “Imagine a "
        "world where”, rather than starting on its specific subject?",
        "Opens with sweeping scene-setting.",
        "Opens directly on the specific subject.",
    ),
    JevTell(
        "summary_closer",
        "Recap conclusion",
        1.0,
        "Does the last paragraph of `text` mainly restate points that were "
        "already made earlier in `text`, for example starting with “In "
        "conclusion”, “Ultimately”, “In summary” or “At the end of the day”, "
        "without adding new information?",
        "The ending is a recap of what was already said.",
        "The ending adds something new, or there is no recap.",
    ),
    JevTell(
        "chatbot_residue",
        "Chatbot residue",
        2.0,
        "Does `text` contain words addressed to the person who requested it "
        "rather than to the reader, such as “Certainly!”, “Great question”, "
        "“Here is a draft”, “I hope this helps”, “Let me know if you'd like "
        "me to” or “As an AI”?",
        "Contains assistant-to-user chatter left in the text.",
        "No assistant chatter.",
    ),
    JevTell(
        "fence_sitting",
        "Fence-sitting balance",
        # Low: encyclopedic writing is neutral by policy.
        0.5,
        "Does `text` lay out several sides or pros and cons of a question and "
        "then end without the author committing to a position of their own?",
        "Balanced survey of views with no committed conclusion.",
        "The author takes a clear position, or the text is not weighing sides.",
    ),
    JevTell(
        "reasons_list",
        "Reasons-list structure",
        1.5,
        "Is `text` organised as a list of separate reasons, factors, benefits "
        "or tips, where each paragraph presents one item and the paragraphs "
        "are introduced by words like “First”, “Another”, “Additionally”, "
        "“Finally”, or by a bold label?",
        "Body is a sequence of one-item-per-paragraph points.",
        "Paragraphs build on each other, or follow a narrative or argument.",
    ),
    JevTell(
        "promotional_tone",
        "Brochure tone",
        1.0,
        "Is `text` written in a promotional register, using words like "
        "“vibrant”, “seamless”, “cutting-edge”, “rich tapestry”, “nestled”, "
        "“unparalleled” or “game-changer” about a subject that is not being "
        "sold?",
        "Reads like marketing copy.",
        "Plain descriptive register, or genuinely an advertisement.",
    ),
]

DOCUMENT_SCORES = [
    ScoreTell(
        "no_voice",
        "Absent personal voice",
        # Low: reference and technical writing is impersonal by design.
        0.6,
        "How much of a particular writer's personality comes through in "
        "`text`?",
        [
            "A distinct voice: personal experience, strong opinions, humor, "
            "odd or memorable word choices.",
            "Some personality, but mostly neutral.",
            "Neutral and impersonal; any competent writer or none could have "
            "written it.",
        ],
    ),
]

# Jev's holistic judgment. It catches slop that dodges every specific tell
# (e.g. a tidy listicle with no stock vocabulary), so it counts toward the
# composite, and it is also shown on its own at the top of the report.
GUT_CHECK = ScoreTell(
    "gut_check",
    "Jev's overall impression",
    2.0,
    "How closely does `text` resemble the default prose style of an AI chat "
    "assistant?",
    [
        "Clearly not chatbot prose.",
        "Some resemblance.",
        "Strong resemblance.",
        "Unmistakably default chatbot prose.",
    ],
)


CODE_TELLS = [
    CodeTell("stock_vocab", "Stock AI vocabulary", 1.5, 0.0, 8.0, "hits per 1k words"),
    CodeTell("em_dash", "Em-dash habit", 0.7, 2.0, 10.0, "per 1k words"),
    CodeTell("low_burstiness", "Uniform sentence length", 1.0, 0.60, 0.30, "coefficient of variation"),
    CodeTell("uniform_paragraphs", "Uniform paragraph length", 0.4, 0.30, 0.10, "coefficient of variation"),
    CodeTell("bold_labels", "Bold labels and lead-ins", 1.0, 0.0, 3.0, "paragraphs"),
    CodeTell("emoji_bullets", "Emoji bullets/headings", 1.0, 0.0, 2.0, "lines"),
]

# Measured case-insensitively on word boundaries. Single words common in
# ordinary prose ("robust", "landscape") are included because the tell is
# their density, not their presence.
STOCK_PHRASES = [
    "delve", "delves", "delving", "tapestry", "testament", "realm",
    "multifaceted", "pivotal", "underscore", "underscores", "underscoring",
    "showcase", "showcases", "showcasing", "foster", "fosters", "fostering",
    "intricate", "intricacies", "vibrant", "bustling", "seamless",
    "seamlessly", "robust", "leverage", "leveraging", "landscape",
    "navigate", "navigating", "embark", "unlock", "unleash", "elevate",
    "resonate", "resonates", "paramount", "meticulous", "meticulously",
    "commendable", "nuanced", "holistic", "synergy", "ever-evolving",
    "ever-changing", "game-changer", "cutting-edge", "groundbreaking",
    "in today's", "it's important to note", "it is important to note",
    "it's worth noting", "it is worth noting", "a testament to",
    "plays a crucial role", "plays a pivotal role", "in the realm of",
    "at the end of the day", "in conclusion", "furthermore", "moreover",
    "additionally", "crucial", "enhance", "enhancing", "comprehensive",
    "valuable insights", "stands as", "serves as",
]
