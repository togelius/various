# ACCESSION (working title)

A turn-based roguelike about getting out of a museum too large to have a floor
plan. Each level is a department of a museum that rearranges itself every night:
its own architecture, its own exhibits asleep on their plinths, its own rule. The
labels are the interface. One object from each department may be kept.

**Status: design phase. Nothing is playable yet.**

- [`DECISIONS.md`](DECISIONS.md) records Julian's answers to the fourteen decisions
  in `DESIGN.md`, what follows from them, the implementation alternatives compared (Unity, Godot, the
  web stack, isometric 3D, generated and downloaded art), the automatic playtesting
  plan, and the questions still open before building. Start here.
- [`DESIGN.md`](DESIGN.md) is the design sketch and the fourteen decisions behind it.
- [`design/`](design/) holds the seven section drafts behind it (reference
  material, written before review).
- [`review/`](review/) holds six adversarial critiques of those drafts, with
  errata from a later verification pass.
- [`research/`](research/) holds twelve research briefs: seven written before the
  design, including a reading of the PCG chapters of *Artificial Intelligence and
  Games* (2nd ed.) for this game, and five comparing implementation options.
- [`prototypes/`](prototypes/) holds throwaway scripts that back numbers in the
  design: a layout generator measured on 3,600 layouts, the door sequencer,
  difficulty curves, generation-cost arithmetic, art probes (code-drawn and
  open-model sprites), a top-down versus isometric 3D readability probe, a C# port
  of a toy core, an engine benchmark and a browser-kill save test.
