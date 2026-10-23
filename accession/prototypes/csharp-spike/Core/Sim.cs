// Toy stand-in for ACCESSION's pure core: integer-only, seeded, no UnityEngine, no floats.
using System;
using System.Collections.Generic;

namespace Accession.Core
{
    public struct Rng
    {
        public uint S;
        public Rng(uint seed) { S = seed == 0 ? 0x9E3779B9u : seed; }
        public uint Next() { uint x = S; x ^= x << 13; x ^= x >> 17; x ^= x << 5; S = x; return x; }
        public int Range(int n) { return (int)(Next() % (uint)n); }
    }

    public enum Act { North = 0, East = 1, South = 2, West = 3, Wait = 4 }
    public enum Ev { Moved = 1, Bumped = 2, Hit = 3, Killed = 4, Woke = 5, Hurt = 6, Died = 7 }

    public sealed class State
    {
        public const int W = 32, H = 24;
        public byte[] Tiles = new byte[W * H]; // 0 floor, 1 wall, 2 vitrine (blocks movement)
        public int Px, Py, Hp, Turn;
        public int[] Mx, My, Mhp;
        public byte[] Awake;
        public Rng Rng;
        public bool Dead;
    }

    public static class Sim
    {
        static readonly int[] Dx = { 0, 1, 0, -1, 0 };
        static readonly int[] Dy = { -1, 0, 1, 0, 0 };

        public static State NewRun(uint seed, int monsters)
        {
            var s = new State();
            s.Rng = new Rng(seed);
            for (int y = 0; y < State.H; y++)
                for (int x = 0; x < State.W; x++)
                {
                    byte t = 0;
                    if (x == 0 || y == 0 || x == State.W - 1 || y == State.H - 1) t = 1;
                    else { int r = s.Rng.Range(100); if (r < 8) t = 1; else if (r < 12) t = 2; }
                    s.Tiles[y * State.W + x] = t;
                }
            s.Px = 1; s.Py = 1; s.Tiles[1 * State.W + 1] = 0; s.Hp = 20;
            s.Mx = new int[monsters]; s.My = new int[monsters]; s.Mhp = new int[monsters]; s.Awake = new byte[monsters];
            for (int i = 0; i < monsters; i++)
            {
                int x, y;
                do { x = 1 + s.Rng.Range(State.W - 2); y = 1 + s.Rng.Range(State.H - 2); }
                while (s.Tiles[y * State.W + x] != 0 || (x < 6 && y < 6) || MonsterAt(s, x, y) >= 0);
                s.Mx[i] = x; s.My[i] = y; s.Mhp[i] = 3 + s.Rng.Range(4);
            }
            return s;
        }

        public static int MonsterAt(State s, int x, int y)
        {
            for (int i = 0; i < s.Mx.Length; i++) if (s.Mhp[i] > 0 && s.Mx[i] == x && s.My[i] == y) return i;
            return -1;
        }

        static bool Passable(State s, int x, int y) { return s.Tiles[y * State.W + x] == 0; }

        // The only mutator: step(state, action) -> events.
        public static void Step(State s, Act a, List<int> events)
        {
            if (s.Dead) return;
            s.Turn++;
            if (a != Act.Wait)
            {
                int nx = s.Px + Dx[(int)a], ny = s.Py + Dy[(int)a];
                int m = MonsterAt(s, nx, ny);
                if (m >= 0)
                {
                    int dmg = s.Awake[m] == 0 ? 6 : 1 + s.Rng.Range(4); // a sleeping target takes maximum damage
                    s.Mhp[m] -= dmg; events?.Add((int)Ev.Hit);
                    if (s.Mhp[m] <= 0) { s.Mhp[m] = 0; events?.Add((int)Ev.Killed); }
                    for (int i = 0; i < s.Mx.Length; i++) // fighting makes noise
                        if (s.Mhp[i] > 0 && s.Awake[i] == 0 && Math.Abs(s.Mx[i] - s.Px) + Math.Abs(s.My[i] - s.Py) <= 4)
                        { s.Awake[i] = 1; events?.Add((int)Ev.Woke); }
                }
                else if (Passable(s, nx, ny)) { s.Px = nx; s.Py = ny; events?.Add((int)Ev.Moved); }
                else events?.Add((int)Ev.Bumped);
            }
            for (int i = 0; i < s.Mx.Length; i++)
            {
                if (s.Mhp[i] <= 0) continue;
                int dx = s.Px - s.Mx[i], dy = s.Py - s.My[i];
                int dist = Math.Abs(dx) + Math.Abs(dy);
                if (s.Awake[i] == 0) { if (dist <= 3) { s.Awake[i] = 1; events?.Add((int)Ev.Woke); } continue; }
                if (dist == 1)
                {
                    s.Hp -= 1 + s.Rng.Range(3); events?.Add((int)Ev.Hurt);
                    if (s.Hp <= 0) { s.Dead = true; events?.Add((int)Ev.Died); return; }
                    continue;
                }
                int sx = Math.Sign(dx), sy = Math.Sign(dy);
                bool horiz = Math.Abs(dx) >= Math.Abs(dy);
                int tx = s.Mx[i] + (horiz ? sx : 0), ty = s.My[i] + (horiz ? 0 : sy);
                if (!Passable(s, tx, ty) || MonsterAt(s, tx, ty) >= 0 || (tx == s.Px && ty == s.Py))
                { tx = s.Mx[i] + (horiz ? 0 : sx); ty = s.My[i] + (horiz ? sy : 0); }
                if (Passable(s, tx, ty) && MonsterAt(s, tx, ty) < 0 && !(tx == s.Px && ty == s.Py)) { s.Mx[i] = tx; s.My[i] = ty; }
            }
            if (s.Turn % 10 == 0 && s.Hp < 20) s.Hp += 1;
        }

        public static uint Hash(State s)
        {
            uint h = 2166136261u;
            void Mix(int v) { for (int k = 0; k < 4; k++) { h ^= (uint)((v >> (8 * k)) & 0xFF); h *= 16777619u; } }
            Mix(s.Px); Mix(s.Py); Mix(s.Hp); Mix(s.Turn); Mix((int)s.Rng.S);
            for (int i = 0; i < s.Mx.Length; i++) { Mix(s.Mx[i]); Mix(s.My[i]); Mix(s.Mhp[i]); Mix(s.Awake[i]); }
            return h;
        }
    }

    public static class Bot
    {
        public static Act Choose(State s, ref Rng botRng)
        {
            int best = -1, bestD = int.MaxValue;
            for (int i = 0; i < s.Mx.Length; i++)
            {
                if (s.Mhp[i] <= 0) continue;
                int d = Math.Abs(s.Mx[i] - s.Px) + Math.Abs(s.My[i] - s.Py);
                if (d < bestD) { bestD = d; best = i; }
            }
            if (best < 0) return Act.Wait;
            if (s.Hp < 6 && bestD > 1) return Act.Wait;
            if (botRng.Range(4) == 0) return (Act)botRng.Range(4);
            int dx = s.Mx[best] - s.Px, dy = s.My[best] - s.Py;
            if (Math.Abs(dx) >= Math.Abs(dy)) return dx > 0 ? Act.East : Act.West;
            return dy > 0 ? Act.South : Act.North;
        }

        public static uint PlayRun(uint seed, int maxTurns, List<int> events, out int turns, out bool won)
        {
            var s = Sim.NewRun(seed, 12);
            var br = new Rng(seed ^ 0xA5A5A5A5u);
            won = false;
            while (!s.Dead && s.Turn < maxTurns)
            {
                bool any = false;
                for (int i = 0; i < s.Mhp.Length; i++) if (s.Mhp[i] > 0) { any = true; break; }
                if (!any) { won = true; break; }
                Sim.Step(s, Choose(s, ref br), events);
            }
            turns = s.Turn;
            return Sim.Hash(s);
        }

        public static uint Batch(uint firstSeed, int count, int maxTurns, out long totalTurns, out int wins)
        {
            uint c = 2166136261u; totalTurns = 0; wins = 0;
            for (uint seed = firstSeed; seed < firstSeed + (uint)count; seed++)
            {
                uint h = PlayRun(seed, maxTurns, null, out int t, out bool w);
                c ^= h; c *= 16777619u; totalTurns += t; if (w) wins++;
            }
            return c;
        }
    }
}
