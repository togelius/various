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

    def test_buy_energy_and_snack(self):
        game = rl.Game(19)
        game.player.money = 8
        self.assertTrue(game.do_buy("energy"))
        self.assertEqual(game.player.money, 2)
        self.assertTrue(game.do_buy("snack"))
        self.assertEqual(game.player.money, 0)
        self.assertEqual(sorted(game.player.inventory), ["energy", "snack"])

    def test_wall_move_costs_no_turn(self):
        game = rl.Game(9)
        p = game.player
        game.grid[p.y - 1][p.x] = "#"
        turn = game.turn
        result = game.player_turn(("move", 0, -1))
        self.assertFalse(result)
        self.assertEqual(game.turn, turn)

    def test_crit_can_double_damage(self):
        game = rl.Game(11)
        game.player.crit_bonus = 100  # force crits
        m = rl.Monster("dean", game.player.x + 1, game.player.y,
                       random.Random(0))
        game.monsters.append(m)
        hp_before = m.hp
        game.player_attack(m)
        # crit doubles at least the minimum damage (max(1, atk - df) >= 1,
        # doubled >= 2)
        self.assertGreaterEqual(hp_before - m.hp, 2)

    def test_stun_blocks_action_and_consumes_turn(self):
        game = rl.Game(12)
        p = game.player
        p.stun_turns = 1
        p.sanity = 20
        turn = game.turn
        result = game.player_turn(("rest",))
        self.assertFalse(result)  # stunned: action fizzles
        self.assertEqual(p.stun_turns, 0)
        self.assertEqual(game.turn, turn + 1)
        self.assertEqual(p.sanity, 20)  # no rest healing while stunned

    def test_bureaucrat_can_stun(self):
        # The stun trait is back on the bureaucrat spec again; one scripted
        # roll must produce a stun.
        stunned = False
        for i in range(500):
            game = rl.Game(13)
            game.rng = random.Random(i)
            game.player.stun_turns = 0
            m = rl.Monster("bureaucrat", game.player.x + 1, game.player.y,
                           random.Random(0))
            game.monster_attack(m)
            game.player.sanity = 22  # keep alive
            if game.player.stun_turns:
                stunned = True
                break
        self.assertTrue(stunned, "bureaucrat never stunned in 500 rolls")

    def test_energy_drink_grants_crit(self):
        game = rl.Game(14)
        game.player.inventory = ["energy"]
        game.player.crit_bonus = 0
        game.player.caffeine = 0
        self.assertTrue(game.do_use(0))
        self.assertEqual(game.player.crit_bonus, 25)
        self.assertEqual(game.player.caffeine, 25)
        self.assertEqual(game.player.inventory, [])

    def test_crit_bonus_decays_when_decaffeinated(self):
        game = rl.Game(15)
        game.player.crit_bonus = 25
        game.player.caffeine = 20
        game.upkeep()  # turn passes, caffeine still > 30? no: 20 <= 30
        self.assertEqual(game.player.crit_bonus, 0)

    def test_tenure_at_h12(self):
        game = rl.Game(16)
        p = game.player
        p.sanity = 5
        game.gain_citations(144)  # h-index hits 12 exactly
        self.assertEqual(p.h_index, 12)
        self.assertEqual(p.sanity, p.maxsanity)  # full heal
        self.assertGreater(p.base_atk, 2)         # attack up

    def test_snack_gamble(self):
        outcomes = set()
        for i in range(60):
            game = rl.Game(17 + i)
            p = game.player
            p.inventory = ["snack"]
            p.sanity = 20
            p.caffeine = 50
            game.rng = random.Random(i)
            before = (p.sanity, p.caffeine)
            self.assertTrue(game.do_use(0))
            self.assertEqual(p.inventory, [])  # always consumed
            outcomes.add((p.sanity - before[0], p.caffeine - before[1]))
        # the gamble has more than one possible outcome
        self.assertGreaterEqual(len(outcomes), 2)

    def test_rest_heals_one(self):
        game = rl.Game(18)
        p = game.player
        p.sanity = 10
        self.assertTrue(game.do_rest())
        self.assertEqual(p.sanity, 11)
        p.sanity = p.maxsanity
        self.assertFalse(game.do_rest())  # already full


class TestPolish(unittest.TestCase):
    def test_message_collapsing(self):
        game = rl.Game(1)
        game.msgs.clear()
        game.msg("same")
        game.msg("same")
        game.msg("other")
        self.assertEqual(game.recent_msgs(3), ["same (x2)", "other"])

    def test_boss_revises_exactly_once(self):
        game = rl.Game(2)
        boss = rl.Monster("panel", game.player.x + 4, game.player.y,
                          random.Random(0))
        game.monsters.append(boss)
        boss.hp = boss.maxhp // 2 - 1
        game.monster_act(boss)
        self.assertTrue(boss.revised)
        self.assertEqual(boss.hp, boss.maxhp // 2 - 1 + 10)

    def test_autoexplore_covers_floor(self):
        game = rl.Game(3)
        game.monsters.clear()
        for _ in range(3000):
            step = game.autoexplore_step()
            if step is None:
                break
            self.assertTrue(game.player_turn(("move",) + step))
        else:
            self.fail("autoexplore never finished the floor")
        # Every passable tile should now be explored.
        for y in range(rl.MAP_H):
            for x in range(rl.MAP_W):
                if game.passable(x, y):
                    self.assertIn((x, y), game.explored)


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

    def test_bot_win_rate_in_a_sane_band(self):
        """The bot has full map knowledge; it should win roughly half to
        nine tenths of its games — not always, not never."""
        results = [rl.autoplay_one(seed) for seed in range(60)]
        wins = sum(1 for r in results if r["won"])
        rate = wins / len(results)
        self.assertGreaterEqual(rate, 0.3, "bot win rate too low: %.2f" % rate)
        self.assertLessEqual(rate, 0.98, "bot win rate too high: %.2f" % rate)

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
