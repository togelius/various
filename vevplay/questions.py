"""The question battery: 20 game-agnostic questions plus a few per-game extras.

Every request sends two frames, `previous` and `current`, about 0.1 s apart,
so that motion questions can be answered. The battery is fixed: never reorder
questions or options between runs, because Vev's answers depend a little on
option order and the feature vector depends on it entirely.
"""

from typesafe_sdk import Choice, Noul, Score

DIRS = {"left": None, "right": None, "above": None, "below": None, "none": "There is none"}
MOVES = {"left": None, "right": None, "up": None, "down": None, "none": "No movement"}
GRID = {f"{r}_{c}": None for r in ("top", "middle", "bottom") for c in ("left", "center", "right")}

GENERAL = {
    "screen_mode": Choice(
        instructions="What is the game showing in `current`?",
        criteria={
            "gameplay": "The game being played",
            "menu_title": "A title screen, start menu or instructions panel",
            "dialogue": "A dialogue or text box that pauses play",
            "game_over": "A game over, death or results screen",
            "transition": "A loading, blank or transition screen",
        },
    ),
    "player_region": Choice(
        instructions="In which part of the `current` screen is the player character?",
        criteria=GRID | {"not_visible": "No player character is visible"},
    ),
    "player_airborne": Noul(instructions="In `current`, is the player character in the air, jumping or falling?"),
    "player_motion": Choice(
        instructions="Comparing `previous` with `current`, which way did the player character move on screen?",
        criteria=MOVES,
    ),
    "player_hurt": Noul(instructions="In `current`, is the player character falling over, knocked back or visibly taking damage?"),
    "health": Score(
        instructions="How much health does the player have left in `current`?",
        criteria=["Almost none", "About half", "Full, or the game shows no health"],
    ),
    "enemy_present": Noul(instructions="Is an enemy or hostile character visible in `current`?"),
    "threat_direction": Choice(
        instructions="In `current`, in which direction is the nearest enemy or hazard, relative to the player character?",
        criteria=DIRS,
    ),
    "threat_distance": Score(
        instructions="In `current`, how close is the nearest enemy or hazard to the player character?",
        criteria=["Touching the player", "Within a few character widths", "Far away", "There is no enemy or hazard"],
    ),
    "projectile": Noul(instructions="Is a projectile, such as a bullet, fireball or thrown object, visible in `current`?"),
    "hazard_in_path": Noul(instructions="In `current`, is there a hazard such as a pit, gap, spikes, fire or water directly in front of the player character?"),
    "path_blocked": Noul(instructions="In `current`, is the player character's way forward blocked by a wall or obstacle?"),
    "ledge_nearby": Noul(instructions="In `current`, is there a platform, ledge or object near the player character that they could jump onto?"),
    "pickup_present": Noul(instructions="Is a collectible item, such as a coin, gem, power-up or health pack, visible in `current`?"),
    "pickup_direction": Choice(
        instructions="In `current`, in which direction is the nearest collectible item, relative to the player character?",
        criteria=DIRS,
    ),
    "goal_visible": Noul(instructions="Is a door, flag, exit or other goal visible in `current`?"),
    "prompt_shown": Noul(instructions="Is the game in `current` showing a panel or button asking the player to start, continue or choose?"),
    "event_flash": Noul(instructions="In `current`, is something momentary happening, such as an explosion, a screen flash or a score popup?"),
    "scroll": Choice(
        instructions="Comparing `previous` with `current`, which way did the background scroll?",
        criteria=MOVES,
    ),
    "urgency": Score(
        instructions="How urgent is the player's situation in `current`?",
        criteria=["Safe, nothing is happening", "Something needs attention soon", "Immediate danger"],
    ),
}

GAME_SPECIFIC = {
    "bollard-hop": {
        "arc_color": Choice(
            instructions="In `current`, what color is the dotted arc showing where the jump will land?",
            criteria={"green": None, "cream": "Cream or off-white", "red": None, "no_arc": "There is no dotted arc"},
        ),
        "wobbling": Noul(instructions="In `current`, is the child standing on a ball off-center, leaning or wobbling?"),
        "charge_level": Score(
            instructions="In `current`, how full is the small vertical charge meter next to the child?",
            criteria=["There is no charge meter", "Less than half full", "About half full", "Nearly or completely full"],
        ),
    },
}


def battery(game: str | None = None) -> dict:
    return GENERAL | GAME_SPECIFIC.get(game, {})


def feature_vector(answers: dict, questions: dict) -> list[float]:
    """Flatten Vev's answers into a fixed-length list of numbers in [0, 1]."""
    out = []
    for qid, q in questions.items():
        a = answers[qid]
        if q.type == "noul":
            out.append(a["noul"])
        elif q.type == "score":
            out.append(a["score"] / (len(q.criteria) - 1))
        else:
            out += [a["probabilities"][opt] for opt in q.criteria]
    return out
