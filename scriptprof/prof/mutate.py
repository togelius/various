"""LLM mutation operator for PuzzleScript games, served locally through Ollama.

This is the ScriptDoctor loop with a local model in the slot GAVEL filled with
a fine-tuned CodeLlama: propose an edit to a game, compile it, feed compiler
errors back, and hand a compiling candidate to the fitness function.

    from prof.mutate import OllamaMutator
    m = OllamaMutator(model="qwen3.8:27b-mlx")
    child_text, log = m.mutate(parent_text, instruction="add one new mechanic")
"""
from __future__ import annotations

import json
import re
import time
import urllib.request
from dataclasses import dataclass, field
from typing import Any

from prof import engine as E

OLLAMA_URL = "http://localhost:11434/api/generate"

SYSTEM = (
    "You are an expert PuzzleScript game designer. PuzzleScript games are single text files with the "
    "sections OBJECTS, LEGEND, SOUNDS, COLLISIONLAYERS, RULES, WINCONDITIONS, LEVELS. Rules are local "
    "pattern rewrites such as `[ > Player | Crate ] -> [ > Player | > Crate ]`. Every object used in a rule "
    "or level must be declared in OBJECTS and placed in COLLISIONLAYERS; every level character must be in "
    "the LEGEND. Output ONLY the complete new game source inside one ```puzzlescript code block."
)

INSTRUCTIONS = [
    "Add one new object with its own rule that creates a new mechanic, and use it in every level.",
    "Change one existing rule so the core mechanic works differently, then adjust the levels so they stay solvable.",
    "Add a second win condition and change the levels so both conditions matter.",
    "Redesign the levels to require longer solutions (at least 20 moves) without changing the rules.",
    "Combine two of the existing mechanics into a new interaction rule and add a level that needs it.",
]

_BLOCK = re.compile(r"```(?:puzzlescript|PuzzleScript|text|txt)?\s*\n(.*?)```", re.S)


@dataclass
class MutationLog:
    model: str
    instruction: str
    attempts: int = 0
    seconds: float = 0.0
    gen_tokens: int = 0
    errors: list[str] = field(default_factory=list)
    ok: bool = False


def extract_game(response: str) -> str | None:
    m = _BLOCK.findall(response)
    if m:
        return max(m, key=len).strip("\n") + "\n"
    # Fallback: the whole response looks like a game if it has section headers.
    if "OBJECTS" in response and "LEVELS" in response:
        return response.strip() + "\n"
    return None


class OllamaMutator:
    def __init__(self, model: str = "qwen3.8:27b-mlx", temperature: float = 0.8,
                 num_ctx: int = 8192, num_predict: int = 3000, think: bool = False,
                 max_attempts: int = 3, timeout: float = 1800.0):
        self.model = model
        self.temperature = temperature
        self.num_ctx = num_ctx
        self.num_predict = num_predict
        self.think = think
        self.max_attempts = max_attempts
        self.timeout = timeout

    def _generate(self, prompt: str) -> tuple[str, int]:
        body = {
            "model": self.model, "prompt": prompt, "system": SYSTEM, "stream": False, "think": self.think,
            "options": {"temperature": self.temperature, "num_ctx": self.num_ctx, "num_predict": self.num_predict},
        }
        req = urllib.request.Request(OLLAMA_URL, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        r = json.loads(urllib.request.urlopen(req, timeout=self.timeout).read())
        return r.get("response", ""), int(r.get("eval_count", 0))

    def mutate(self, parent: str, instruction: str) -> tuple[str | None, MutationLog]:
        """Return a compiling child (or None) and a log. Compiler errors are fed back."""
        log = MutationLog(model=self.model, instruction=instruction)
        t0 = time.time()
        prompt = (f"Here is a PuzzleScript game:\n\n```puzzlescript\n{parent}\n```\n\n"
                  f"Task: {instruction}\nKeep the game's style. Output the complete modified game.")
        child = None
        for attempt in range(self.max_attempts):
            log.attempts = attempt + 1
            resp, ntok = self._generate(prompt)
            log.gen_tokens += ntok
            cand = extract_game(resp)
            if cand is None:
                log.errors.append("no code block in response")
                prompt += "\n\nYour previous reply contained no ```puzzlescript code block. Output the complete game in one code block."
                continue
            try:
                E.compile_text(cand)
            except E.CompileError as e:
                msg = str(e)[:600]
                log.errors.append(msg)
                prompt = (f"Here is a PuzzleScript game:\n\n```puzzlescript\n{cand}\n```\n\n"
                          f"It fails to compile with this error:\n{msg}\n\nFix the error and output the complete corrected game "
                          f"in one ```puzzlescript code block. The original task was: {instruction}")
                continue
            child = cand
            log.ok = True
            break
        log.seconds = time.time() - t0
        return child, log
