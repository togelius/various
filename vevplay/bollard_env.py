"""Bollard Hop as a steppable environment, with ground truth for the questions.

The game keeps its state inside a closure, so the harness patches the HTML at
load time (the file in the repo is untouched). The patch exposes the state and
switches the game to manual stepping, so the game waits while Vev thinks.
"""

import os
from pathlib import Path

from playwright.sync_api import sync_playwright

GAME = Path(__file__).resolve().parent.parent / "bollard-hop" / "index.html"
DT = 1 / 30

HOOK = """
  window.__bh = {
    manual: false,
    start() { start(); },
    press() { press(); },
    release() { release(); },
    step(dt) { update(dt); render(); },
    state() {
      const arc = charging && kid.st === 'stand' ? predictArc().hit : null;
      return {
        phase, overT, score, combo, charge, charging, camX, S, OY, W, H, viewW,
        pops: pops.length,
        titleVisible: !$('titleScreen').hidden, overVisible: !$('overScreen').hidden,
        kid: { st: kid.st, b: kid.b, d: kid.d, dv: kid.dv, x: kid.x, y: kid.y },
        balls: balls.map(b => ({ cx: b.cx, cy: b.cy, r: b.r, visited: b.visited })),
        arc: arc ? { miss: !!arc.miss, perfect: !!arc.perfect } : null,
      };
    },
  };
"""


def _patched_html() -> str:
    html = GAME.read_text()
    anchor = "  // Title screen shows a live street"
    frame = "  function frame(now) {\n"
    assert anchor in html and frame in html, "bollard-hop/index.html changed; update the patch"
    html = html.replace(anchor, HOOK + anchor)
    return html.replace(frame, frame + "    if (window.__bh.manual) { last = now; requestAnimationFrame(frame); return; }\n")


class BollardEnv:
    def __init__(self, width=960, height=540):
        self._pw = sync_playwright().start()
        exe = os.environ.get("CHROMIUM_PATH")  # optional: use a system Chromium
        self.browser = self._pw.chromium.launch(executable_path=exe) if exe else self._pw.chromium.launch()
        self.page = self.browser.new_page(viewport={"width": width, "height": height})
        # Fonts are cosmetic; don't let a slow font server hold up loading.
        self.page.route("**/fonts.*/**", lambda r: r.abort())
        self.page.set_content(_patched_html(), wait_until="load")
        self.page.evaluate("window.__bh.manual = true")

    def start(self):
        self.page.evaluate("window.__bh.start()")
        self.step(1)

    def press(self):
        self.page.evaluate("window.__bh.press()")

    def release(self):
        self.page.evaluate("window.__bh.release()")

    def step(self, n=1):
        self.page.evaluate(f"for (let i = 0; i < {n}; i++) window.__bh.step({DT})")

    def state(self) -> dict:
        return self.page.evaluate("window.__bh.state()")

    def screenshot(self) -> bytes:
        return self.page.screenshot(type="png")

    def close(self):
        self.browser.close()
        self._pw.stop()


# ---------- ground truth ----------

def _screen_xy(s, wx, wy):
    """Game world coordinates to fractions of the screen (0..1)."""
    return (wx - s["camX"]) * s["S"] / s["W"], (wy * s["S"] + s["OY"]) / s["H"]


def _player_xy(s):
    k = s["kid"]
    return _screen_xy(s, k["x"], k["y"] - 40)  # middle of the body, not the feet


def truth(prev: dict, cur: dict) -> dict:
    """Correct answers for the questions that have one in Bollard Hop.

    Questions with no meaningful answer in this game (health, enemies,
    pickups...) get the "none"/"no" answer the question allows for. Values are
    a noul in {0, 1}, a choice option, or a score level index.
    """
    k = cur["kid"]
    playing = not cur["titleVisible"] and not cur["overVisible"]
    t = {}

    t["screen_mode"] = "menu_title" if cur["titleVisible"] else "game_over" if cur["overVisible"] else "gameplay"
    if playing or cur["overVisible"]:
        x, y = _player_xy(cur)
        if 0 <= x <= 1 and 0 <= y <= 1:
            col = ("left", "center", "right")[min(2, int(x * 3))]
            row = ("top", "middle", "bottom")[min(2, int(y * 3))]
            t["player_region"] = f"{row}_{col}"
    t["player_airborne"] = int(k["st"] in ("air", "fall"))
    (px, py), (cx, cy) = _player_xy(prev), _player_xy(cur)
    dx, dy = (cx - px) * cur["W"], (cy - py) * cur["H"]  # pixels
    t["player_motion"] = ("none" if max(abs(dx), abs(dy)) < 4 else
                          ("right" if dx > 0 else "left") if abs(dx) >= abs(dy) else ("down" if dy > 0 else "up"))
    t["player_hurt"] = int(k["st"] in ("fall", "down"))
    t["health"] = 2
    t["enemy_present"] = 0
    t["projectile"] = 0
    t["path_blocked"] = 0
    t["pickup_present"] = 0
    t["pickup_direction"] = "none"
    t["goal_visible"] = 0
    t["prompt_shown"] = int(cur["titleVisible"] or cur["overVisible"])
    t["event_flash"] = int(cur["pops"] > 0)
    cam = (cur["camX"] - prev["camX"]) * cur["S"]
    t["scroll"] = "none" if abs(cam) < 3 else "left" if cam > 0 else "right"  # camera right = scene left

    nxt = next((b for b in cur["balls"] if not b["visited"]), None)
    if playing:
        bx = _screen_xy(cur, nxt["cx"], nxt["cy"])[0] if nxt else 2
        t["ledge_nearby"] = int(0 <= bx <= 1)
        t["hazard_in_path"] = int(k["st"] == "stand")  # the gap to the next ball
        wobble = k["st"] == "stand" and (abs(k["d"]) > 0.15 * cur["balls"][k["b"]]["r"] or abs(k["dv"]) > 10)
        risky = cur["arc"] is not None and cur["arc"]["miss"]
        t["urgency"] = 2 if k["st"] == "fall" else 1 if (wobble or risky) else 0
        t["wobbling"] = int(wobble)
        t["arc_color"] = ("no_arc" if cur["arc"] is None else "red" if cur["arc"]["miss"]
                          else "green" if cur["arc"]["perfect"] else "cream")
        c = cur["charge"] if cur["charging"] and k["st"] == "stand" else None
        t["charge_level"] = 0 if c is None else 1 if c < 0.4 else 2 if c < 0.75 else 3
    return t
