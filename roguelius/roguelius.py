#!/usr/bin/env python3
"""
ROGUELIUS: The Vicissitudes of NYU
===================================

A terminal roguelike in which you play as Julian Togelius, professor of
computer science, ascending the procedurally generated floors of 370 Jay
Street to defend a grant proposal before The Grant Panel on the roof.

The elevator is, of course, broken.

Runs on the Python standard library only (curses for the UI).

    python3 roguelius.py                # play
    python3 roguelius.py --seed 42      # play a specific building layout
    python3 roguelius.py --autoplay 100 # headless balance testing (bot plays)

Keys are documented in-game (press ?).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
from collections import deque

# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------

MAP_W, MAP_H = 80, 18
NUM_FLOORS = 8
FOV_RADIUS = 8
INV_CAP = 10
MAX_TURNS = 4000  # autoplay safety net

FLOOR_NAMES = [
    "Lobby & Security Gates",
    "Undergraduate Advising",
    "The Lecture Halls",
    "The Open-Plan Lab",
    "Administrative Suite",
    "Committee Chambers",
    "The Dean's Antechamber",
    "Rooftop: The Grant Panel Hearing",
]

CONFERENCES = ["NeurIPS", "ICML", "CHI", "AAAI", "IJCAI", "FDG", "CoG", "GECCO"]

DIRS8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]

# Floor modifiers: one may apply per floor, announced on arrival.
MODIFIERS = {
    None: None,
    "fire_drill": "A fire drill is in progress. Everyone is agitated and wandering.",
    "wifi_down": "The wifi is down on this floor. Reviewers must confront you in person.",
    "free_pizza": "Someone left free pizza in the kitchen. Morale improves nearby.",
    "ac_broken": "The AC is broken. The heat saps your caffeine faster.",
}

# ----------------------------------------------------------------------------
# Monster and item definitions
# ----------------------------------------------------------------------------
# traits: slow (acts every other turn), fast (acts twice), ranged, aura
#         (drains caffeine when near), swarm (may replicate), summoner, boss

MONSTERS = {
    "email": dict(ch="e", name="Unread Email", hp=2, atk=1, df=0, cite=1,
                  color="yellow", traits={"swarm"}, depths=(1, 6), w=5),
    "undergrad": dict(ch="u", name="Confused Undergrad", hp=5, atk=1, df=0,
                      cite=2, color="green", traits=set(), depths=(1, 4), w=4),
    "phd": dict(ch="p", name="PhD Student (needs a meeting)", hp=7, atk=2,
                df=0, cite=3, color="cyan", traits=set(), depths=(1, 6), w=3),
    "bureaucrat": dict(ch="b", name="Bureaucrat", hp=12, atk=2, df=2, cite=4,
                       color="blue", traits={"slow"}, depths=(2, 7), w=3),
    "reviewer": dict(ch="r", name="Reviewer 2", hp=8, atk=3, df=0, cite=5,
                     color="red", traits={"ranged"}, depths=(3, 8), w=3),
    "deadline": dict(ch="D", name="Deadline", hp=7, atk=3, df=0, cite=4,
                     color="magenta", traits={"fast"}, depths=(3, 8), w=3),
    "meeting": dict(ch="M", name="Faculty Meeting", hp=16, atk=2, df=1, cite=6,
                    color="yellow", traits={"slow", "aura"}, depths=(4, 8), w=2),
    "committee": dict(ch="C", name="Curriculum Committee", hp=18, atk=3, df=1,
                      cite=7, color="blue", traits={"slow", "summoner"},
                      depths=(5, 8), w=2),
    "dean": dict(ch="A", name="Associate Dean", hp=14, atk=4, df=1, cite=8,
                 color="magenta", traits=set(), depths=(6, 8), w=3),
    "panel": dict(ch="G", name="The Grant Panel", hp=46, atk=4, df=1, cite=30,
                  color="red", traits={"ranged", "summoner", "boss"},
                  depths=(8, 8), w=0),
}

ITEMS = {
    "coffee": dict(ch="%", name="Drip Coffee", color="yellow",
                   depths=(1, 8), w=5),
    "espresso": dict(ch="!", name="Quad Espresso", color="yellow",
                     depths=(3, 8), w=2),
    "bagel": dict(ch="&", name="Everything Bagel", color="green",
                  depths=(1, 8), w=3),
    "sandwich": dict(ch="&", name="Deli Sandwich", color="green",
                     depths=(3, 8), w=2),
    "money": dict(ch="$", name="Reimbursement Check", color="green",
                  depths=(1, 8), w=3),
    "preprint": dict(ch="?", name="Intriguing Preprint", color="cyan",
                     depths=(1, 8), w=3),
    "laser": dict(ch="/", name="Laser Pointer", color="white",
                  depths=(1, 3), w=1),
    "keyboard": dict(ch="/", name="Mechanical Keyboard", color="white",
                     depths=(3, 8), w=1),
    "tweed": dict(ch="[", name="Tweed Jacket", color="white",
                  depths=(1, 4), w=1),
    "headphones": dict(ch="[", name="Noise-Canceling Headphones",
                       color="white", depths=(4, 8), w=1),
    "gpu": dict(ch="*", name="GPU Cluster Token", color="magenta",
                depths=(4, 8), w=1),
    "sabbatical": dict(ch="=", name="Sabbatical Form", color="cyan",
                       depths=(4, 7), w=1),
}

WEAPONS = {"laser": 1, "keyboard": 2}
ARMOR = {"tweed": 1, "headphones": 1}

KILL_MSGS = {
    "email": "Archived. Inbox zero feels briefly possible.",
    "undergrad": "The undergrad finally gets it. They promise to cite you.",
    "phd": "Great meeting! The PhD student leaves with newfound purpose.",
    "bureaucrat": "The form is stamped in triplicate. The bureaucrat retreats.",
    "reviewer": "Reviewer 2 concedes your contribution is, in fact, novel.",
    "deadline": "Submitted with four minutes to spare.",
    "meeting": "Meeting adjourned. You reclaim your afternoon.",
    "committee": "The committee votes to table the discussion indefinitely.",
    "dean": "The Associate Dean approves your course release.",
    "panel": "The panel is silent. Then: 'Fund it.'",
}

ATTACK_MSGS = {
    "email": "An URGENT email demands your attention",
    "undergrad": "The undergrad asks if this will be on the exam",
    "phd": "The PhD student needs feedback on chapter 3, tonight",
    "bureaucrat": "The bureaucrat requires another form",
    "reviewer": "Reviewer 2 attacks your methodology",
    "deadline": "The deadline looms closer",
    "meeting": "The meeting spawns an action item for you",
    "committee": "The committee assigns you to a subcommittee",
    "dean": "The Associate Dean suggests you teach an extra section",
    "panel": "The panel frowns at your budget justification",
}

REVIEWER_LINES = [
    "Reviewer 2: 'The novelty is unclear.'",
    "Reviewer 2: 'Why not compare against a 2009 baseline?'",
    "Reviewer 2: 'This is merely engineering.'",
    "Reviewer 2: 'I am not convinced by Figure 3.'",
    "Reviewer 2: 'Missing citation: my own work (2014).'",
]

PANEL_LINES = [
    "The Panel: 'Your broader impacts are vague.'",
    "The Panel: 'The budget seems... ambitious.'",
    "The Panel: 'Is this transformative, or merely excellent?'",
    "The Panel: 'How does this differ from your last proposal?'",
]

PLAYER_VERBS = [
    "You rebut", "You politely dismantle", "You cite prior work at",
    "You out-argue", "You calmly refute", "You counterexample",
]

AMBIENT = [
    "Somewhere below, a fire alarm chirps hopefully.",
    "A distant printer jams in solidarity.",
    "The espresso machine on this floor is 'being serviced.'",
    "You overhear: '...we'll just call the results preliminary.'",
    "A calendar notification buzzes. You choose not to look.",
    "The elevator dings somewhere. It is lying.",
    "Someone has scheduled a meeting about reducing meetings.",
    "A whiteboard nearby reads: DO NOT ERASE (erased).",
    "Through a window: the East River, indifferent to peer review.",
]

# ----------------------------------------------------------------------------
# Geometry helpers
# ----------------------------------------------------------------------------


def sign(v):
    return (v > 0) - (v < 0)


def cheb(x0, y0, x1, y1):
    return max(abs(x0 - x1), abs(y0 - y1))


def bresenham(x0, y0, x1, y1):
    """Yield grid cells from (x0,y0) to (x1,y1) inclusive."""
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx, sy = sign(x1 - x0), sign(y1 - y0)
    err = dx - dy
    x, y = x0, y0
    while True:
        yield x, y
        if x == x1 and y == y1:
            return
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x += sx
        if e2 < dx:
            err += dx
            y += sy


class Rect:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h

    def center(self):
        return self.x + self.w // 2, self.y + self.h // 2

    def intersects(self, other, gap=1):
        return (self.x - gap < other.x + other.w and
                self.x + self.w + gap > other.x and
                self.y - gap < other.y + other.h and
                self.y + self.h + gap > other.y)

    def cells(self):
        for yy in range(self.y, self.y + self.h):
            for xx in range(self.x, self.x + self.w):
                yield xx, yy


# ----------------------------------------------------------------------------
# Map generation
# ----------------------------------------------------------------------------


def gen_map(rng, depth):
    """Rooms-and-corridors floor plan. Returns (grid, rooms)."""
    grid = [["#"] * MAP_W for _ in range(MAP_H)]
    rooms = []
    attempts = 0
    while len(rooms) < 9 and attempts < 120:
        attempts += 1
        w = rng.randint(5, 13)
        h = rng.randint(3, 6)
        x = rng.randint(1, MAP_W - w - 2)
        y = rng.randint(1, MAP_H - h - 2)
        room = Rect(x, y, w, h)
        if any(room.intersects(r) for r in rooms):
            continue
        rooms.append(room)
        for xx, yy in room.cells():
            grid[yy][xx] = "."

    def carve_h(x1, x2, y):
        for x in range(min(x1, x2), max(x1, x2) + 1):
            grid[y][x] = "."

    def carve_v(y1, y2, x):
        for y in range(min(y1, y2), max(y1, y2) + 1):
            grid[y][x] = "."

    for i in range(1, len(rooms)):
        x1, y1 = rooms[i - 1].center()
        x2, y2 = rooms[i].center()
        if rng.random() < 0.5:
            carve_h(x1, x2, y1)
            carve_v(y1, y2, x2)
        else:
            carve_v(y1, y2, x1)
            carve_h(x1, x2, y2)

    # A couple of extra loops so floors aren't pure corridic trees.
    if len(rooms) > 4:
        for _ in range(2):
            a, b = rng.sample(range(len(rooms)), 2)
            x1, y1 = rooms[a].center()
            x2, y2 = rooms[b].center()
            carve_h(x1, x2, y1)
            carve_v(y1, y2, x2)

    return grid, rooms


def bfs_dists(grid, sx, sy):
    dist = {(sx, sy): 0}
    q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        for dx, dy in DIRS8:
            nx, ny = x + dx, y + dy
            if (0 <= nx < MAP_W and 0 <= ny < MAP_H and
                    grid[ny][nx] != "#" and (nx, ny) not in dist):
                dist[(nx, ny)] = dist[(x, y)] + 1
                q.append((nx, ny))
    return dist


def bfs_path(grid, start, goals, blocked=frozenset()):
    """Shortest path from start to any goal. Blocked cells are impassable
    unless they are goals. Returns list of cells excluding start, or None."""
    goals = set(goals)
    if start in goals:
        return []
    prev = {start: None}
    q = deque([start])
    while q:
        cur = q.popleft()
        for dx, dy in DIRS8:
            nx, ny = cur[0] + dx, cur[1] + dy
            if not (0 <= nx < MAP_W and 0 <= ny < MAP_H):
                continue
            cell = (nx, ny)
            if cell in prev or grid[ny][nx] not in ".>":
                continue
            if cell in blocked and cell not in goals:
                continue
            prev[cell] = cur
            if cell in goals:
                path = [cell]
                while prev[path[-1]] != start:
                    path.append(prev[path[-1]])
                path.reverse()
                return path
            q.append(cell)
    return None


# ----------------------------------------------------------------------------
# Entities
# ----------------------------------------------------------------------------


class Monster:
    def __init__(self, kind, x, y, rng, depth=1):
        spec = MONSTERS[kind]
        self.kind = kind
        self.x, self.y = x, y
        self.ch = spec["ch"]
        # The university hardens with altitude: monsters found above their
        # native floor get tougher, so the endgame resists stat snowballs.
        bonus = 0 if "boss" in spec["traits"] else \
            min(3, max(0, depth - spec["depths"][0]) // 2)
        self.hp = self.maxhp = spec["hp"] + bonus
        self.atk = spec["atk"] + (1 if bonus >= 3 else 0)
        self.df = spec["df"]
        self.cite = spec["cite"]
        self.color = spec["color"]
        self.traits = set(spec["traits"])
        self.awake = False
        self.revised = False  # boss second-wind flag
        self.name = spec["name"]
        if kind == "deadline":
            self.name = "Deadline (%s)" % rng.choice(CONFERENCES)


class Item:
    def __init__(self, kind, x=0, y=0):
        spec = ITEMS[kind]
        self.kind = kind
        self.x, self.y = x, y
        self.ch = spec["ch"]
        self.name = spec["name"]
        self.color = spec["color"]


class Player:
    def __init__(self):
        self.x = self.y = 0
        self.maxsanity = 22
        self.sanity = 22
        self.caffeine = 60
        self.maxcaffeine = 100
        self.citations = 0
        self.h_index = 0
        self.money = 8
        self.base_atk = 2
        self.inventory = []
        self.weapon = None   # item kind
        self.armor = None    # item kind

    @property
    def atk(self):
        a = self.base_atk + (WEAPONS.get(self.weapon, 0))
        if self.caffeine <= 0:
            a -= 1  # decaffeinated
        return max(1, a)

    @property
    def df(self):
        return ARMOR.get(self.armor, 0)


# ----------------------------------------------------------------------------
# Game
# ----------------------------------------------------------------------------


class Game:
    def __init__(self, seed=None):
        if seed is None:
            seed = random.randrange(10 ** 6)
        self.rng = random.Random(seed)
        self.seed = seed
        self.player = Player()
        self.depth = 0
        self.turn = 0
        self.msgs = deque(maxlen=120)
        self.over = False
        self.won = False
        self.death_cause = ""
        self.modifier = None
        self.explored = set()
        self.visible = set()
        self.next_floor()
        self.msg("Another day at 370 Jay Street. Your grant proposal is due "
                 "on the roof. The elevator is broken.")
        self.msg("Press ? for help. Good luck, Professor.")

    # -- messaging ----------------------------------------------------------

    def msg(self, text):
        if self.msgs and self.msgs[-1][0] == text:
            self.msgs[-1][1] += 1
        else:
            self.msgs.append([text, 1])

    def recent_msgs(self, n):
        out = []
        for text, count in list(self.msgs)[-n:]:
            out.append(text if count == 1 else "%s (x%d)" % (text, count))
        return out

    # -- floor setup --------------------------------------------------------

    def next_floor(self):
        self.depth += 1
        self.grid, self.rooms = gen_map(self.rng, self.depth)
        p = self.player
        p.x, p.y = self.rooms[0].center()
        dists = bfs_dists(self.grid, p.x, p.y)

        # Stairs in the farthest room (none on the top floor).
        far_room = max(self.rooms[1:], key=lambda r: dists.get(r.center(), 0),
                       default=self.rooms[-1])
        self.stairs = far_room.center()
        if self.depth < NUM_FLOORS:
            self.grid[self.stairs[1]][self.stairs[0]] = ">"

        # Vending machine somewhere central-ish, most floors.
        if self.rng.random() < 0.7 and len(self.rooms) > 2:
            room = self.rng.choice(self.rooms[1:-1])
            vx, vy = room.center()
            if (vx, vy) != (p.x, p.y) and self.grid[vy][vx] == ".":
                self.grid[vy][vx] = "V"

        # Floor modifier.
        self.modifier = None
        if 1 < self.depth < NUM_FLOORS and self.rng.random() < 0.45:
            self.modifier = self.rng.choice(
                ["fire_drill", "wifi_down", "free_pizza", "ac_broken"])

        self.monsters = []
        self.items = []
        self.explored = set()
        self.spawn_floor_contents(dists)
        self.update_fov()

        self.msg("Floor %d: %s." % (self.depth, FLOOR_NAMES[self.depth - 1]))
        if self.modifier:
            self.msg(MODIFIERS[self.modifier])
        if self.depth == NUM_FLOORS:
            self.msg("The Grant Panel awaits. Defend your proposal!")

    def open_cells(self, dists, min_dist=4):
        cells = [c for c, d in dists.items() if d >= min_dist
                 and self.grid[c[1]][c[0]] == "."]
        self.rng.shuffle(cells)
        return cells

    def spawn_floor_contents(self, dists):
        rng = self.rng
        cells = self.open_cells(dists)
        occupied = set()

        def take_cell():
            while cells:
                c = cells.pop()
                if c not in occupied:
                    occupied.add(c)
                    return c
            return None

        # Monsters.
        if self.depth == NUM_FLOORS:
            roster = ["panel", "reviewer", "reviewer", "committee", "dean"]
            for kind in roster:
                c = take_cell()
                if c:
                    m = Monster(kind, c[0], c[1], rng, self.depth)
                    if kind == "panel":
                        # Boss guards the far end of the floor.
                        m.x, m.y = self.stairs
                        occupied.add(self.stairs)
                    self.monsters.append(m)
        else:
            pool = [(k, s["w"]) for k, s in MONSTERS.items()
                    if s["w"] > 0 and s["depths"][0] <= self.depth <= s["depths"][1]]
            kinds, weights = zip(*pool)
            n = 4 + self.depth + rng.randint(0, 2)
            for _ in range(n):
                c = take_cell()
                if not c:
                    break
                kind = rng.choices(kinds, weights)[0]
                self.monsters.append(Monster(kind, c[0], c[1], rng, self.depth))
            # Early floors get a small email cluster for tutorial fodder.
            if self.depth <= 3:
                c = take_cell()
                if c:
                    for dx, dy in [(0, 0)] + DIRS8[:2]:
                        x, y = c[0] + dx, c[1] + dy
                        if self.grid[y][x] != "#" and (x, y) not in occupied:
                            occupied.add((x, y))
                            self.monsters.append(Monster("email", x, y, rng, self.depth))

        if self.modifier == "fire_drill":
            for m in self.monsters:
                m.awake = True

        # Items.
        pool = [(k, s["w"]) for k, s in ITEMS.items()
                if s["depths"][0] <= self.depth <= s["depths"][1]]
        kinds, weights = zip(*pool)
        n_items = rng.randint(3, 5)
        if self.modifier == "free_pizza":
            n_items += 2
        placed = []
        for _ in range(n_items):
            c = take_cell()
            if not c:
                break
            kind = rng.choices(kinds, weights)[0]
            if self.modifier == "free_pizza" and rng.random() < 0.5:
                kind = "bagel"
            placed.append(kind)
            self.items.append(Item(kind, c[0], c[1]))
        # Guarantee caffeine supply on most floors.
        if self.depth <= 6 and "coffee" not in placed and "espresso" not in placed:
            c = take_cell()
            if c:
                self.items.append(Item("coffee", c[0], c[1]))
        # Stock up before the boss: floor 7 always has supplies.
        if self.depth == NUM_FLOORS - 1:
            for kind in ("espresso", "sandwich"):
                c = take_cell()
                if c:
                    self.items.append(Item(kind, c[0], c[1]))

    # -- queries ------------------------------------------------------------

    def monster_at(self, x, y):
        for m in self.monsters:
            if m.hp > 0 and m.x == x and m.y == y:
                return m
        return None

    def item_at(self, x, y):
        for it in self.items:
            if it.x == x and it.y == y:
                return it
        return None

    def passable(self, x, y):
        return 0 <= x < MAP_W and 0 <= y < MAP_H and self.grid[y][x] in ".>"

    def los(self, x0, y0, x1, y1):
        for x, y in bresenham(x0, y0, x1, y1):
            if (x, y) == (x1, y1):
                return True
            if (x, y) != (x0, y0) and self.grid[y][x] == "#":
                return False
        return True

    def update_fov(self):
        p = self.player
        vis = {(p.x, p.y)}
        r = FOV_RADIUS
        for y in range(max(0, p.y - r), min(MAP_H, p.y + r + 1)):
            for x in range(max(0, p.x - r), min(MAP_W, p.x + r + 1)):
                if (x - p.x) ** 2 + (y - p.y) ** 2 > r * r:
                    continue
                for cx, cy in bresenham(p.x, p.y, x, y):
                    vis.add((cx, cy))
                    if self.grid[cy][cx] == "#" and (cx, cy) != (x, y):
                        break
        self.visible = vis
        self.explored |= vis
        for m in self.monsters:
            if (m.x, m.y) in vis:
                m.awake = True

    # -- player actions -----------------------------------------------------
    # Each returns True if a turn was consumed.

    def do_move(self, dx, dy):
        p = self.player
        nx, ny = p.x + dx, p.y + dy
        target = self.monster_at(nx, ny)
        if target:
            self.player_attack(target)
            return True
        if not (0 <= nx < MAP_W and 0 <= ny < MAP_H):
            return False
        tile = self.grid[ny][nx]
        if tile == "V":
            return "vending"  # UI opens the vending menu; no turn spent
        if tile == "#":
            return False
        p.x, p.y = nx, ny
        it = self.item_at(nx, ny)
        if it:
            self.msg("You see a %s here. (g to grab)" % it.name)
        if tile == ">":
            self.msg("Stairs up. (press > to climb)")
        return True

    def do_wait(self):
        return True

    def do_stairs(self):
        p = self.player
        if self.grid[p.y][p.x] == ">":
            self.msg("You trudge up another flight of stairs.")
            self.next_floor()
            return True
        self.msg("There are no stairs here.")
        return False

    def do_get(self):
        p = self.player
        it = self.item_at(p.x, p.y)
        if not it:
            self.msg("Nothing here to pick up.")
            return False
        if it.kind == "money":
            amount = self.rng.randint(3, 9)
            p.money += amount
            self.items.remove(it)
            self.msg("A reimbursement check clears! +$%d." % amount)
            return True
        if len(p.inventory) >= INV_CAP:
            self.msg("Your bag is full. (10 items max)")
            return False
        self.items.remove(it)
        p.inventory.append(it.kind)
        self.msg("You pick up the %s." % it.name)
        return True

    def do_use(self, idx):
        p = self.player
        if idx < 0 or idx >= len(p.inventory):
            return False
        kind = p.inventory[idx]
        name = ITEMS[kind]["name"]
        rng = self.rng

        if kind == "coffee":
            p.caffeine = min(p.maxcaffeine, p.caffeine + 35)
            self.msg("Ahh, drip coffee. Caffeine +35.")
        elif kind == "espresso":
            p.caffeine = min(p.maxcaffeine, p.caffeine + 70)
            self.msg("The quad espresso hits like a rejected rebuttal. "
                     "Caffeine +70.")
        elif kind == "bagel":
            p.sanity = min(p.maxsanity, p.sanity + 8)
            self.msg("The everything bagel restores you. Sanity +8.")
        elif kind == "sandwich":
            p.sanity = min(p.maxsanity, p.sanity + 12)
            self.msg("A proper deli sandwich. Sanity +12.")
        elif kind == "preprint":
            gain = rng.randint(1, 4)
            if rng.random() < 0.2:
                p.sanity = max(0, p.sanity - 1)
                self.msg("The preprint's evaluation is flawed. It costs you "
                         "1 sanity, but you can cite it anyway. +%d citations."
                         % gain)
            else:
                self.msg("A genuinely good preprint! +%d citations." % gain)
            self.gain_citations(gain)
            self.check_death("a deeply flawed preprint")
        elif kind in WEAPONS:
            old = p.weapon
            p.weapon = kind
            self.msg("You wield the %s (+%d attack)." % (name, WEAPONS[kind]))
            p.inventory.pop(idx)
            if old:
                p.inventory.append(old)
            return True
        elif kind in ARMOR:
            old = p.armor
            p.armor = kind
            extra = " Emails can no longer reach you." \
                if kind == "headphones" else ""
            self.msg("You don the %s (+%d defense).%s"
                     % (name, ARMOR[kind], extra))
            p.inventory.pop(idx)
            if old:
                p.inventory.append(old)
            return True
        elif kind == "gpu":
            hit = 0
            for m in self.monsters:
                if m.hp > 0 and (m.x, m.y) in self.visible:
                    m.hp -= 9
                    hit += 1
                    if m.hp <= 0:
                        self.kill_monster(m, silent=True)
            self.msg("You commandeer the GPU cluster and produce overwhelming "
                     "results. %d foes are humbled (9 damage each)." % hit)
        elif kind == "sabbatical":
            if self.depth >= NUM_FLOORS:
                self.msg("No paperwork can save you from the Panel.")
                return False
            sx, sy = self.stairs
            # Land adjacent to the stairs if the stairs cell is occupied.
            spots = [(sx, sy)] + [(sx + dx, sy + dy) for dx, dy in DIRS8]
            for x, y in spots:
                if self.passable(x, y) and not self.monster_at(x, y):
                    p.x, p.y = x, y
                    break
            self.msg("You file the sabbatical form. Reality shifts; you are "
                     "suddenly at the stairwell.")
        else:
            return False
        p.inventory.pop(idx)
        return True

    def do_drop(self, idx):
        p = self.player
        if idx < 0 or idx >= len(p.inventory):
            return False
        kind = p.inventory.pop(idx)
        self.items.append(Item(kind, p.x, p.y))
        self.msg("You leave the %s behind. Someone will adopt it."
                 % ITEMS[kind]["name"])
        return True

    def do_lecture(self):
        p = self.player
        if p.caffeine < 12:
            self.msg("Too decaffeinated to lecture. (needs 12 caffeine)")
            return False
        targets = [m for m in self.monsters if m.hp > 0
                   and cheb(p.x, p.y, m.x, m.y) <= 1]
        if not targets:
            self.msg("You lecture the empty hallway. It is unmoved.")
            return False
        p.caffeine -= 12
        self.msg("You deliver an impromptu lecture on procedural content "
                 "generation!")
        for m in targets:
            dmg = max(1, p.atk + 3 - m.df)
            m.hp -= dmg
            if m.hp <= 0:
                self.kill_monster(m)
            else:
                self.msg("The %s reels (%d)." % (m.name, dmg))
        return True

    def do_deepwork(self):
        p = self.player
        if p.caffeine < 20:
            self.msg("Deep work requires caffeine. (needs 20)")
            return False
        if p.sanity >= p.maxsanity:
            self.msg("You are already at peak sanity. Save the focus.")
            return False
        p.caffeine -= 20
        p.sanity = min(p.maxsanity, p.sanity + 6)
        self.msg("Ninety focused minutes. Sanity +6.")
        return True

    def do_buy(self, what):
        p = self.player
        prices = {"coffee": 3, "bagel": 5}
        cost = prices.get(what)
        if cost is None:
            return False
        if p.money < cost:
            self.msg("The machine blinks: INSUFFICIENT FUNDS.")
            return False
        if len(p.inventory) >= INV_CAP:
            self.msg("Your bag is full.")
            return False
        p.money -= cost
        p.inventory.append(what)
        self.msg("The vending machine dispenses a %s. (-$%d)"
                 % (ITEMS[what]["name"], cost))
        return True

    def do_quick_coffee(self):
        p = self.player
        for i, kind in enumerate(p.inventory):
            if kind in ("coffee", "espresso"):
                return self.do_use(i)
        self.msg("No coffee in your bag. There must be a machine somewhere.")
        return False

    # -- combat -------------------------------------------------------------

    def player_attack(self, m):
        p = self.player
        dmg = max(1, p.atk + self.rng.randint(0, 2) - m.df)
        m.hp -= dmg
        if m.hp <= 0:
            self.kill_monster(m)
        else:
            verb = self.rng.choice(PLAYER_VERBS)
            self.msg("%s the %s (%d)." % (verb, m.name, dmg))

    def kill_monster(self, m, silent=False):
        m.hp = min(m.hp, 0)
        if m in self.monsters:
            self.monsters.remove(m)
        if not silent:
            self.msg(KILL_MSGS.get(m.kind, "The %s is dealt with." % m.name))
        self.gain_citations(m.cite)
        if m.kind == "phd" and self.rng.random() < 0.3:
            self.items.append(Item("preprint", m.x, m.y))
            self.msg("They leave a draft behind for you to read.")
        if "boss" in m.traits:
            self.won = True
            self.over = True

    def gain_citations(self, n):
        p = self.player
        p.citations += n
        new_h = int(math.isqrt(p.citations))
        while new_h > p.h_index:
            p.h_index += 1
            p.maxsanity += 2
            p.sanity = min(p.maxsanity, p.sanity + 2)
            if p.h_index % 3 == 0:
                p.base_atk += 1
                self.msg("Your h-index rises to %d! You argue with new "
                         "authority. (attack up)" % p.h_index)
            else:
                self.msg("Your h-index rises to %d! (max sanity up)"
                         % p.h_index)

    def monster_attack(self, m, ranged=False):
        p = self.player
        if m.kind == "email" and p.armor == "headphones":
            self.msg("An email bounces off your noise-canceling headphones.")
            return
        atk = m.atk - 1 if ranged else m.atk
        dmg = max(1, atk + self.rng.randint(0, 1) - p.df)
        p.sanity -= dmg
        base = ATTACK_MSGS.get(m.kind, "The %s wears you down" % m.name)
        self.msg("%s (%d sanity)." % (base, dmg))
        self.check_death(m.name)

    def check_death(self, cause):
        p = self.player
        if p.sanity <= 0 and not self.over:
            p.sanity = 0
            self.over = True
            self.won = False
            self.death_cause = cause
            self.msg("You burn out. The %s was the last straw." % cause)

    # -- monster turn -------------------------------------------------------

    def monsters_act(self):
        p = self.player
        for m in list(self.monsters):
            if self.over:
                return
            if m.hp <= 0:
                continue
            acts = 1
            if "fast" in m.traits:
                acts = 2
            if "slow" in m.traits and self.turn % 2 == 1:
                acts = 0
            for _ in range(acts):
                if self.over or m.hp <= 0:
                    break
                attacked = self.monster_act(m)
                if attacked:
                    break  # fast monsters close distance twice, hit once

    def monster_act(self, m):
        """One monster action. Returns True if it attacked the player."""
        p = self.player
        rng = self.rng
        d = cheb(m.x, m.y, p.x, p.y)
        see = d <= FOV_RADIUS + 2 and self.los(m.x, m.y, p.x, p.y)
        if see:
            m.awake = True

        if "boss" in m.traits and not m.revised and m.hp < m.maxhp // 2:
            m.revised = True
            m.hp = min(m.maxhp, m.hp + 10)
            self.msg("The Panel requests MAJOR REVISIONS. Your arguments "
                     "must begin anew! (The Panel rallies, +10)")
            return False

        if d <= 1:
            self.monster_attack(m)
            return True

        ranged_ok = ("ranged" in m.traits and self.modifier != "wifi_down")
        if ranged_ok and see and d <= 5:
            if d <= 2 and rng.random() < 0.6:
                # Keep academic distance.
                self.step_away(m)
                return False
            if rng.random() < 0.5:
                lines = PANEL_LINES if m.kind == "panel" else REVIEWER_LINES
                self.msg(rng.choice(lines))
                self.monster_attack(m, ranged=True)
                return True

        if "summoner" in m.traits and see and self.turn % 6 == 0:
            if m.kind == "panel":
                live_reviewers = sum(1 for x in self.monsters
                                     if x.kind == "reviewer" and x.hp > 0)
                if live_reviewers < 3:
                    c = self.free_adjacent(m)
                    if c:
                        self.monsters.append(Monster("reviewer", c[0], c[1], rng, self.depth))
                        self.msg("The Panel calls in another external reviewer!")
                        return False
            else:
                c = self.free_adjacent(m)
                if c:
                    self.monsters.append(Monster("email", c[0], c[1], rng, self.depth))
                    self.msg("The committee generates correspondence.")
                    return False

        if "swarm" in m.traits and rng.random() < 0.02:
            n_emails = sum(1 for x in self.monsters
                           if x.kind == "email" and x.hp > 0)
            if n_emails < 10:
                c = self.free_adjacent(m)
                if c:
                    self.monsters.append(Monster("email", c[0], c[1], rng, self.depth))
                    if (m.x, m.y) in self.visible:
                        self.msg("Your inbox grows.")

        if m.awake:
            self.step_toward(m, p.x, p.y)
        elif rng.random() < 0.3:
            dx, dy = rng.choice(DIRS8)
            self.try_step(m, dx, dy)
        return False

    def free_adjacent(self, m):
        opts = [(m.x + dx, m.y + dy) for dx, dy in DIRS8]
        self.rng.shuffle(opts)
        for x, y in opts:
            if self.passable(x, y) and not self.monster_at(x, y) \
                    and (x, y) != (self.player.x, self.player.y):
                return (x, y)
        return None

    def try_step(self, m, dx, dy):
        nx, ny = m.x + dx, m.y + dy
        if self.passable(nx, ny) and not self.monster_at(nx, ny) \
                and (nx, ny) != (self.player.x, self.player.y):
            m.x, m.y = nx, ny
            return True
        return False

    def step_toward(self, m, tx, ty):
        dx, dy = sign(tx - m.x), sign(ty - m.y)
        for ox, oy in [(dx, dy), (dx, 0), (0, dy)]:
            if (ox, oy) != (0, 0) and self.try_step(m, ox, oy):
                return True
        return False

    def step_away(self, m):
        p = self.player
        dx, dy = sign(m.x - p.x), sign(m.y - p.y)
        for ox, oy in [(dx, dy), (dx, 0), (0, dy)]:
            if (ox, oy) != (0, 0) and self.try_step(m, ox, oy):
                return True
        return False

    # -- upkeep -------------------------------------------------------------

    def upkeep(self):
        p = self.player
        self.turn += 1
        drain_every = 4 if self.modifier == "ac_broken" else 5
        if self.turn % drain_every == 0:
            p.caffeine = max(0, p.caffeine - 1)
            if p.caffeine == 0 and self.turn % (drain_every * 2) == 0:
                p.sanity -= 1
                self.msg("Caffeine withdrawal headache. (-1 sanity)")
                self.check_death("caffeine withdrawal")
        if p.caffeine >= 30 and p.sanity < p.maxsanity and self.turn % 6 == 0:
            p.sanity += 1
        if self.turn % 47 == 0:
            self.msg(self.rng.choice(AMBIENT))
        # Faculty Meetings drain the will to live from a distance.
        for m in self.monsters:
            if "aura" in m.traits and m.hp > 0 \
                    and cheb(m.x, m.y, p.x, p.y) <= 2 \
                    and (m.x, m.y) in self.visible:
                p.caffeine = max(0, p.caffeine - 1)
                if self.turn % 5 == 0:
                    self.msg("The meeting drags on. Your caffeine fades.")

    # -- the full turn ------------------------------------------------------

    def player_turn(self, action):
        """Apply an action tuple; advance the world if it consumed a turn.
        Returns the raw result of the action ('vending', True, False)."""
        if self.over:
            return False
        kind = action[0]
        if kind == "move":
            result = self.do_move(action[1], action[2])
        elif kind == "wait":
            result = self.do_wait()
        elif kind == "get":
            result = self.do_get()
        elif kind == "use":
            result = self.do_use(action[1])
        elif kind == "drop":
            result = self.do_drop(action[1])
        elif kind == "stairs":
            result = self.do_stairs()
        elif kind == "lecture":
            result = self.do_lecture()
        elif kind == "deepwork":
            result = self.do_deepwork()
        elif kind == "buy":
            result = self.do_buy(action[1])
        elif kind == "coffee":
            result = self.do_quick_coffee()
        else:
            result = False
        if result is True and not self.over:
            self.monsters_act()
            if not self.over:
                self.upkeep()
            self.update_fov()
        return result

    def autoexplore_step(self):
        """First step of a path toward the nearest unexplored tile, or None
        when the whole floor has been seen. Used by the 'o' command."""
        p = self.player
        goals = {(x, y) for y in range(MAP_H) for x in range(MAP_W)
                 if self.passable(x, y) and (x, y) not in self.explored}
        if not goals:
            return None
        blocked = {(m.x, m.y) for m in self.monsters if m.hp > 0}
        path = bfs_path(self.grid, (p.x, p.y), goals, blocked)
        if not path:
            return None
        nx, ny = path[0]
        return (nx - p.x, ny - p.y)

    def hostiles_visible(self):
        return [m for m in self.monsters
                if m.hp > 0 and (m.x, m.y) in self.visible]

    def score(self):
        p = self.player
        return (p.citations + 10 * self.depth + p.money
                + (100 if self.won else 0))


# ----------------------------------------------------------------------------
# Autoplay bot (for balance testing)
# ----------------------------------------------------------------------------


def bot_useless(game, kind):
    """True if the bot has no use for this item kind."""
    p = game.player
    if kind in WEAPONS:
        return WEAPONS[kind] <= WEAPONS.get(p.weapon, 0)
    if kind in ARMOR:
        return ARMOR[kind] <= ARMOR.get(p.armor, 0)
    return False


def bot_action(game):
    p = game.player
    inv = p.inventory

    def has(*kinds):
        for i, k in enumerate(inv):
            if k in kinds:
                return i
        return None

    # Equip upgrades immediately.
    for kinds, slot in ((WEAPONS, p.weapon), (ARMOR, p.armor)):
        best_idx, best_val = None, kinds.get(slot, 0)
        for i, k in enumerate(inv):
            if k in kinds and kinds[k] > best_val:
                best_idx, best_val = i, kinds[k]
        if best_idx is not None:
            return ("use", best_idx)

    # Bag management: shed anything that no longer helps.
    for i, k in enumerate(inv):
        if bot_useless(game, k):
            return ("drop", i)
    if len(inv) >= INV_CAP:
        if p.caffeine <= 65:
            idx = has("coffee", "espresso")
            if idx is not None:
                return ("use", idx)
        if p.sanity <= p.maxsanity - 8:
            idx = has("bagel", "sandwich")
            if idx is not None:
                return ("use", idx)
        idx = has("preprint")
        if idx is not None and p.sanity > 4:
            return ("use", idx)

    # Emergency consumption.
    if p.sanity <= 8:
        idx = has("sandwich", "bagel")
        if idx is not None:
            return ("use", idx)
    if p.caffeine <= 15:
        idx = has("coffee", "espresso")
        if idx is not None:
            return ("use", idx)
    if p.sanity <= 6 and p.caffeine >= 20 and not adjacent_monsters(game):
        return ("deepwork",)

    adj = adjacent_monsters(game)
    boss = next((m for m in game.monsters if "boss" in m.traits and m.hp > 0),
                None)
    if boss and (boss.x, boss.y) in game.visible:
        idx = has("gpu")
        if idx is not None:
            return ("use", idx)
    if len(adj) >= 2 and p.caffeine >= 12:
        return ("lecture",)
    if adj:
        m = min(adj, key=lambda m: m.hp)
        return ("move", sign(m.x - p.x), sign(m.y - p.y))

    # Read preprints when safe.
    if not adj:
        idx = has("preprint")
        if idx is not None and p.sanity > 4:
            return ("use", idx)

    here = game.item_at(p.x, p.y)
    if here and (here.kind == "money"
                 or (len(inv) < INV_CAP and not bot_useless(game, here.kind))):
        return ("get",)
    if game.grid[p.y][p.x] == ">" and game.depth < NUM_FLOORS:
        return ("stairs",)

    blocked = {(m.x, m.y) for m in game.monsters if m.hp > 0}
    start = (p.x, p.y)

    # Visit worthwhile items first, then stairs / the boss.
    goals = set()
    want_items = len(inv) < INV_CAP
    for it in game.items:
        if it.kind == "money" or (want_items
                                  and not bot_useless(game, it.kind)):
            goals.add((it.x, it.y))
    if goals:
        path = bfs_path(game.grid, start, goals, blocked)
        if path:
            nx, ny = path[0]
            return ("move", nx - p.x, ny - p.y)

    if game.depth < NUM_FLOORS:
        target = {game.stairs}
    elif boss:
        target = {(boss.x, boss.y)}
    else:
        target = {(m.x, m.y) for m in game.monsters if m.hp > 0}
    if target:
        path = bfs_path(game.grid, start, target, blocked)
        if path:
            nx, ny = path[0]
            # Bump-attacks are allowed; blocked non-goal monsters aren't in path
            mon = game.monster_at(nx, ny)
            if mon or game.passable(nx, ny):
                return ("move", nx - p.x, ny - p.y)
    # Fight whatever is reachable if truly stuck.
    reach = bfs_path(game.grid, start,
                     {(m.x, m.y) for m in game.monsters if m.hp > 0})
    if reach:
        nx, ny = reach[0]
        return ("move", nx - p.x, ny - p.y)
    return ("wait",)


def adjacent_monsters(game):
    p = game.player
    return [m for m in game.monsters if m.hp > 0
            and cheb(p.x, p.y, m.x, m.y) <= 1]


def autoplay_one(seed):
    game = Game(seed)
    stuck = 0
    while not game.over and game.turn < MAX_TURNS:
        action = bot_action(game)
        result = game.player_turn(action)
        if result == "vending":
            if game.player.money >= 3 and len(game.player.inventory) < INV_CAP:
                game.player_turn(("buy", "coffee"))
            else:
                stuck += 1
                game.player_turn(("wait",))
        elif result is False:
            stuck += 1
            game.player_turn(("wait",))
        else:
            stuck = 0
        if stuck > 30:
            break
    return dict(won=game.won, depth=game.depth, turns=game.turn,
                score=game.score(), cause=game.death_cause,
                citations=game.player.citations,
                timeout=game.turn >= MAX_TURNS or (not game.over))


def run_autoplay(n, base_seed):
    results = []
    for i in range(n):
        seed = (base_seed or 0) + i
        r = autoplay_one(seed)
        results.append(r)
    wins = sum(1 for r in results if r["won"])
    timeouts = sum(1 for r in results if r["timeout"] and not r["won"])
    avg_depth = sum(r["depth"] for r in results) / len(results)
    avg_turns = sum(r["turns"] for r in results) / len(results)
    avg_cites = sum(r["citations"] for r in results) / len(results)
    causes = {}
    for r in results:
        if not r["won"] and r["cause"]:
            causes[r["cause"]] = causes.get(r["cause"], 0) + 1
    print("games: %d  wins: %d (%.0f%%)  timeouts/stuck: %d"
          % (n, wins, 100 * wins / n, timeouts))
    print("avg depth: %.2f  avg turns: %.0f  avg citations: %.1f"
          % (avg_depth, avg_turns, avg_cites))
    depth_hist = {}
    for r in results:
        depth_hist[r["depth"]] = depth_hist.get(r["depth"], 0) + 1
    print("depth reached:", " ".join("%d:%d" % (d, c) for d, c
                                     in sorted(depth_hist.items())))
    top = sorted(causes.items(), key=lambda kv: -kv[1])[:8]
    if top:
        print("top causes of burnout:")
        for cause, count in top:
            print("  %3d  %s" % (count, cause))


# ----------------------------------------------------------------------------
# High scores
# ----------------------------------------------------------------------------

SCORE_FILE = os.path.expanduser("~/.roguelius_scores.json")


def record_score(game):
    entry = dict(score=game.score(), won=game.won, depth=game.depth,
                 citations=game.player.citations, h=game.player.h_index,
                 turns=game.turn, seed=game.seed,
                 cause="grant funded" if game.won else game.death_cause)
    try:
        scores = []
        if os.path.exists(SCORE_FILE):
            with open(SCORE_FILE) as f:
                scores = json.load(f)
        scores.append(entry)
        scores.sort(key=lambda e: -e["score"])
        with open(SCORE_FILE, "w") as f:
            json.dump(scores[:10], f, indent=1)
        return scores[:10]
    except Exception:
        return [entry]


# ----------------------------------------------------------------------------
# Curses UI
# ----------------------------------------------------------------------------

HELP_LINES = [
    "ROGUELIUS — how to survive NYU",
    "",
    "  Move       arrows / hjkl (yubn for diagonals)",
    "  .          wait a turn",
    "  g          grab item     >  climb stairs",
    "  i          inventory (letter: use/equip, SHIFT+letter: drop)",
    "  c          quick-drink first coffee in bag",
    "  o          auto-explore    v  review visible foes",
    "  z          Lecture: hit all adjacent foes (12 caffeine)",
    "  x          Deep Work: restore 6 sanity (20 caffeine)",
    "  ?          this help    Q  abandon the semester",
    "",
    "  @  you       e email      u undergrad   p PhD student",
    "  b  bureaucrat  r Reviewer 2  D deadline  M faculty meeting",
    "  C  committee   A assoc. dean  G THE GRANT PANEL",
    "  %! coffee    &  food      ?  preprint    $ reimbursement",
    "  /  weapon    [  armor     *  GPU token   = sabbatical form",
    "  V  vending machine (walk into it)   >  stairs up",
    "",
    "  Caffeine drains each turn; at zero you fight worse and lose",
    "  sanity. Citations raise your h-index, which raises your stats.",
    "  Reach the roof and defeat The Grant Panel.",
    "  (press any key)",
]


def run_curses(stdscr, seed):
    import curses
    curses.curs_set(0)
    stdscr.keypad(True)
    has_color = curses.has_colors()
    if has_color:
        curses.start_color()
        curses.use_default_colors()
        pairs = {"white": 1, "red": 2, "green": 3, "yellow": 4,
                 "blue": 5, "magenta": 6, "cyan": 7}
        colors = {"white": curses.COLOR_WHITE, "red": curses.COLOR_RED,
                  "green": curses.COLOR_GREEN, "yellow": curses.COLOR_YELLOW,
                  "blue": curses.COLOR_BLUE, "magenta": curses.COLOR_MAGENTA,
                  "cyan": curses.COLOR_CYAN}
        for name, idx in pairs.items():
            curses.init_pair(idx, colors[name], -1)

    def attr(color, bold=False, dim=False):
        a = 0
        if has_color and color in ("white", "red", "green", "yellow",
                                   "blue", "magenta", "cyan"):
            a = curses.color_pair({"white": 1, "red": 2, "green": 3,
                                   "yellow": 4, "blue": 5, "magenta": 6,
                                   "cyan": 7}[color])
        if bold:
            a |= curses.A_BOLD
        if dim:
            a |= curses.A_DIM
        return a

    def put(y, x, text, a=0):
        try:
            stdscr.addstr(y, x, text, a)
        except curses.error:
            pass

    def draw(game):
        stdscr.erase()
        h, w = stdscr.getmaxyx()
        if h < 24 or w < 80:
            put(0, 0, "Terminal too small — need at least 80x24.")
            stdscr.refresh()
            return
        p = game.player
        title = " ROGUELIUS   Floor %d/%d: %s " % (
            game.depth, NUM_FLOORS, FLOOR_NAMES[game.depth - 1])
        put(0, 0, title, attr("white", bold=True))
        put(0, max(0, 80 - 25), "Bldg #%06d  Turn %d" % (game.seed, game.turn),
            attr("white", dim=True))

        for y in range(MAP_H):
            for x in range(MAP_W):
                cell = (x, y)
                ch = game.grid[y][x]
                if cell in game.visible:
                    if ch == "#":
                        put(y + 1, x, "#", attr("white", dim=True))
                    elif ch == ">":
                        put(y + 1, x, ">", attr("white", bold=True))
                    elif ch == "V":
                        put(y + 1, x, "V", attr("magenta", bold=True))
                    else:
                        put(y + 1, x, ".", attr("white", dim=True))
                elif cell in game.explored:
                    if ch == "#":
                        put(y + 1, x, "#", attr("blue", dim=True))
                    elif ch == ">":
                        put(y + 1, x, ">", attr("white"))
                    elif ch == "V":
                        put(y + 1, x, "V", attr("magenta", dim=True))
        for it in game.items:
            if (it.x, it.y) in game.visible:
                put(it.y + 1, it.x, it.ch, attr(it.color, bold=True))
        for m in game.monsters:
            if m.hp > 0 and (m.x, m.y) in game.visible:
                put(m.y + 1, m.x, m.ch,
                    attr(m.color, bold="boss" in m.traits or m.atk >= 3))
        put(p.y + 1, p.x, "@", attr("white", bold=True))

        # Status
        wpn = ITEMS[p.weapon]["name"] if p.weapon else "Bare Rhetoric"
        arm = ITEMS[p.armor]["name"] if p.armor else "Conference T-Shirt"
        status = ("Sanity %2d/%-2d  Caffeine %3d  Cites %3d (h=%d)  $%-3d "
                  "Atk %d Def %d"
                  % (p.sanity, p.maxsanity, p.caffeine, p.citations,
                     p.h_index, p.money, p.atk, p.df))
        sanity_frac = p.sanity / max(1, p.maxsanity)
        scolor = "green" if sanity_frac > 0.5 else \
            ("yellow" if sanity_frac > 0.25 else "red")
        put(MAP_H + 1, 0, status, attr(scolor, bold=sanity_frac <= 0.25))
        put(MAP_H + 2, 0, "Wielding: %s   Wearing: %s" % (wpn, arm),
            attr("white", dim=True))
        boss = next((m for m in game.monsters
                     if "boss" in m.traits and m.hp > 0), None)
        if boss and (boss.x, boss.y) in game.visible:
            frac = boss.hp / boss.maxhp
            bar = "#" * int(20 * frac)
            put(MAP_H + 2, 46, "PANEL [%-20s]" % bar, attr("red", bold=True))

        msgs = game.recent_msgs(3)
        for i, mtext in enumerate(msgs):
            a = attr("white", bold=(i == len(msgs) - 1))
            put(MAP_H + 3 + i, 0, mtext[:79], a)
        stdscr.refresh()

    def show_lines(lines, color="white"):
        stdscr.erase()
        for i, line in enumerate(lines):
            put(i + 1, 4, line, attr(color, bold=(i == 0)))
        stdscr.refresh()
        stdscr.getch()

    def inventory_menu(game):
        p = game.player
        stdscr.erase()
        put(1, 4, "Your bag (%d/%d) — letter: use/equip, SHIFT+letter: drop, "
            "other: cancel" % (len(p.inventory), INV_CAP),
            attr("white", bold=True))
        if not p.inventory:
            put(3, 6, "Empty. Like your calendar never is.")
        for i, kind in enumerate(p.inventory):
            tag = ""
            if kind in WEAPONS:
                tag = "  (+%d atk)" % WEAPONS[kind]
            if kind in ARMOR:
                tag = "  (+%d def)" % ARMOR[kind]
            put(3 + i, 6, "%s) %s%s" % (chr(ord("a") + i),
                                        ITEMS[kind]["name"], tag))
        stdscr.refresh()
        key = stdscr.getch()
        idx = key - ord("a")
        if 0 <= idx < len(p.inventory):
            return ("use", idx)
        idx = key - ord("A")
        if 0 <= idx < len(p.inventory):
            return ("drop", idx)
        return None

    def vending_menu(game):
        stdscr.erase()
        put(1, 4, "The vending machine hums expectantly. ($%d in pocket)"
            % game.player.money, attr("magenta", bold=True))
        put(3, 6, "a) Drip Coffee ........ $3")
        put(4, 6, "b) Everything Bagel ... $5")
        put(6, 6, "(any other key to walk away)")
        stdscr.refresh()
        key = stdscr.getch()
        if key == ord("a"):
            return "coffee"
        if key == ord("b"):
            return "bagel"
        return None

    def end_screen(game):
        scores = record_score(game)
        lines = []
        if game.won:
            lines += [
                "THE GRANT IS FUNDED.",
                "",
                "The panel chair shakes your hand. Somewhere below,",
                "an inbox fills with congratulations and new obligations.",
                "You take the stairs down. The elevator is still broken.",
            ]
            color = "green"
        else:
            cause = game.death_cause or "the university itself"
            lines += [
                "YOU HAVE BURNED OUT.",
                "",
                "Cause of burnout: %s." % cause,
                "Your out-of-office reply will run for some time.",
            ]
            color = "red"
        p = game.player
        lines += [
            "",
            "Floor reached: %d/%d — %s" % (game.depth, NUM_FLOORS,
                                           FLOOR_NAMES[game.depth - 1]),
            "Citations: %d   h-index: %d   Turns: %d" %
            (p.citations, p.h_index, game.turn),
            "FINAL SCORE: %d   (building permit #%06d — replay with "
            "--seed %d)" % (game.score(), game.seed, game.seed),
            "",
            "High scores:",
        ]
        for i, e in enumerate(scores[:5]):
            lines.append("  %d. %5d  depth %d  h=%d  (%s)"
                         % (i + 1, e["score"], e["depth"], e["h"], e["cause"]))
        lines += ["", "(n) new semester    (any other key) quit"]
        stdscr.erase()
        for i, line in enumerate(lines):
            put(i + 2, 8, line, attr(color if i == 0 else "white",
                                     bold=(i == 0)))
        stdscr.refresh()
        return stdscr.getch() in (ord("n"), ord("N"))

    KEYMAP = {}

    def bind_keys():
        import curses as c
        for keys, action in [
            ((c.KEY_UP, ord("k")), ("move", 0, -1)),
            ((c.KEY_DOWN, ord("j")), ("move", 0, 1)),
            ((c.KEY_LEFT, ord("h")), ("move", -1, 0)),
            ((c.KEY_RIGHT, ord("l")), ("move", 1, 0)),
            ((ord("y"),), ("move", -1, -1)),
            ((ord("u"),), ("move", 1, -1)),
            ((ord("b"),), ("move", -1, 1)),
            ((ord("n"),), ("move", 1, 1)),
            ((ord("."), ord("s")), ("wait",)),
            ((ord("g"), ord(",")), ("get",)),
            ((ord(">"),), ("stairs",)),
            ((ord("z"),), ("lecture",)),
            ((ord("x"),), ("deepwork",)),
            ((ord("c"),), ("coffee",)),
        ]:
            for k in keys:
                KEYMAP[k] = action

    bind_keys()

    while True:
        game = Game(seed)
        seed = None  # subsequent games get fresh layouts
        while not game.over:
            draw(game)
            key = stdscr.getch()
            if key in (ord("Q"),):
                game.over = True
                game.death_cause = "a sudden career change"
                break
            if key == ord("?"):
                show_lines(HELP_LINES)
                continue
            if key == ord("i"):
                chosen = inventory_menu(game)
                if chosen is not None:
                    game.player_turn(chosen)
                continue
            if key == ord("v"):
                foes = game.hostiles_visible()
                lines = ["Visible on this floor:"]
                if not foes:
                    lines.append("")
                    lines.append("  Nothing. Enjoy it while it lasts.")
                for m in sorted(foes, key=lambda m: -m.atk):
                    traits = ", ".join(sorted(m.traits)) or "ordinary"
                    lines.append("  %s  %-32s %2d/%-2d hp  atk %d  (%s)"
                                 % (m.ch, m.name, m.hp, m.maxhp,
                                    m.atk, traits))
                lines += ["", "(press any key)"]
                show_lines(lines)
                continue
            if key == ord("o"):
                # Auto-explore until something needs attention.
                import time as _time
                steps = 0
                while steps < 120 and not game.over:
                    if game.hostiles_visible():
                        game.msg("You spot trouble and stop exploring.")
                        break
                    step = game.autoexplore_step()
                    if step is None:
                        game.msg("This floor holds no more surprises.")
                        break
                    result = game.player_turn(("move",) + step)
                    if result is not True:
                        break
                    steps += 1
                    p = game.player
                    if game.item_at(p.x, p.y) or game.grid[p.y][p.x] == ">":
                        break
                    draw(game)
                    _time.sleep(0.02)
                continue
            action = KEYMAP.get(key)
            if not action:
                continue
            result = game.player_turn(action)
            if result == "vending":
                choice = vending_menu(game)
                if choice:
                    game.player_turn(("buy", choice))
        draw(game)
        if not end_screen(game):
            return


# ----------------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser(
        description="ROGUELIUS: The Vicissitudes of NYU")
    ap.add_argument("--seed", type=int, default=None,
                    help="RNG seed for a reproducible building")
    ap.add_argument("--autoplay", type=int, metavar="N", default=0,
                    help="run N headless bot games and print balance stats")
    args = ap.parse_args()

    if args.autoplay:
        run_autoplay(args.autoplay, args.seed)
        return

    import curses
    curses.wrapper(run_curses, args.seed)


if __name__ == "__main__":
    main()
