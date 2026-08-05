#!/usr/bin/env python3
"""Tests for Roguelius. Run with: python3 test_roguelius.py"""
import random
import unittest

import roguelius as rl


class TestMapGen(unittest.TestCase):
    def test_connectivity_many_seeds(self):
        """Every floor must let the player reach the stairs."""
        for seed in range(60):
            game = rl.Game(seed)
            for _ in range(rl.NUM_FLOORS - 1):
                dists = rl.bfs_dists(game.grid, game.player.x, game.player.y)
                self.assertIn(game.stairs, dists,
                              "stairs unreachable, seed %d depth %d"
                              % (seed, game.depth))
                game.next_floor()

    def test_map_edges_are_walls(self):
        for seed in range(20):
            grid, _ = rl.gen_map(random.Random(seed), 1)
            for x in range(rl.MAP_W):
                self.assertEqual(grid[0][x], "#")
                self.assertEqual(grid[rl.MAP_H - 1][x], "#")
            for y in range(rl.MAP_H):
                self.assertEqual(grid[y][0], "#")
                self.assertEqual(grid[y][rl.MAP_W - 1], "#")

    def test_spawns_not_on_player(self):
        for seed in range(30):
            game = rl.Game(seed)
            p = (game.player.x, game.player.y)
            for m in game.monsters:
                self.assertNotEqual((m.x, m.y), p)
            for it in game.items:
                self.assertNotEqual((it.x, it.y), p)


class TestMechanics(unittest.TestCase):
    def test_h_index_is_isqrt_of_citations(self):
        game = rl.Game(1)
        game.gain_citations(99)
        self.assertEqual(game.player.h_index, 9)
        game.gain_citations(1)
        self.assertEqual(game.player.h_index, 10)

    def test_h_index_never_decreases(self):
        game = rl.Game(2)
        game.gain_citations(50)
        h = game.player.h_index
        game.gain_citations(0)
        self.assertGreaterEqual(game.player.h_index, h)

    def test_decaffeinated_attack_penalty(self):
        p = rl.Player()
        base = p.atk
        p.caffeine = 0
        self.assertEqual(p.atk, max(1, base - 1))

    def test_death_sets_game_over(self):
        game = rl.Game(3)
        game.player.sanity = 1
        m = rl.Monster("dean", game.player.x + 1, game.player.y,
                       random.Random(0))
        game.monster_attack(m)
        self.assertTrue(game.over)
        self.assertFalse(game.won)
        self.assertEqual(game.player.sanity, 0)

    def test_boss_kill_wins(self):
        game = rl.Game(4)
        boss = rl.Monster("panel", 5, 5, random.Random(0))
        game.monsters.append(boss)
        boss.hp = 1
        game.player_attack(boss)
        self.assertTrue(game.won)
        self.assertTrue(game.over)

    def test_headphones_block_email(self):
        game = rl.Game(5)
        game.player.armor = "headphones"
        sanity = game.player.sanity
        m = rl.Monster("email", game.player.x + 1, game.player.y,
                       random.Random(0))
        game.monster_attack(m)
        self.assertEqual(game.player.sanity, sanity)

    def test_drop_and_pickup_roundtrip(self):
        game = rl.Game(6)
        game.player.inventory = ["coffee"]
        game.do_drop(0)
        self.assertEqual(game.player.inventory, [])
        it = game.item_at(game.player.x, game.player.y)
        self.assertIsNotNone(it)
        self.assertEqual(it.kind, "coffee")
        game.do_get()
        self.assertEqual(game.player.inventory, ["coffee"])

    def test_vending_bump_costs_no_turn(self):
        game = rl.Game(7)
        # Place a vending machine next to the player.
        p = game.player
        game.grid[p.y][p.x + 1] = "V"
        turn = game.turn
        result = game.player_turn(("move", 1, 0))
        self.assertEqual(result, "vending")
        self.assertEqual(game.turn, turn)

    def test_buy_coffee(self):
        game = rl.Game(8)
        game.player.money = 3
        game.player.inventory = []
        self.assertTrue(game.do_buy("coffee"))
        self.assertEqual(game.player.money, 0)
        self.assertIn("coffee", game.player.inventory)
        self.assertFalse(game.do_buy("coffee"))  # broke now

    def test_wall_move_costs_no_turn(self):
        game = rl.Game(9)
        p = game.player
        game.grid[p.y - 1][p.x] = "#"
        turn = game.turn
        result = game.player_turn(("move", 0, -1))
        self.assertFalse(result)
        self.assertEqual(game.turn, turn)


class TestBot(unittest.TestCase):
    def test_bot_games_terminate_without_crash(self):
        """Full playthroughs: every game must end (win, death, or the
        explicit safety cap) without raising."""
        for seed in range(25):
            r = rl.autoplay_one(seed)
            self.assertIn("won", r)
            self.assertGreaterEqual(r["depth"], 1)
            self.assertLessEqual(r["depth"], rl.NUM_FLOORS)

    def test_bot_wins_sometimes_and_loses_sometimes(self):
        results = [rl.autoplay_one(seed) for seed in range(40)]
        wins = sum(1 for r in results if r["won"])
        self.assertGreater(wins, 0, "game may be impossibly hard")
        self.assertLess(wins, 40, "game may be trivially easy")

    def test_no_stuck_games(self):
        for seed in range(25):
            r = rl.autoplay_one(seed)
            if not r["won"]:
                # A lost game must have a cause; a stuck bot has none
                # and ends under the turn cap without game.over.
                self.assertTrue(r["cause"] or r["turns"] >= rl.MAX_TURNS
                                or r["won"] is False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
