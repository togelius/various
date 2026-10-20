# Review of the section drafts

Six critics read the seven drafts in [`../design/`](../design/), each through one lens, and were asked to be adversarial. Their findings are ranked BLOCKER, MAJOR and MINOR. Most were adopted into [`../DESIGN.md`](../DESIGN.md); [`../design/README.md`](../design/README.md) lists what changed.

They are critiques, not verified facts. Their counts and estimates (lines of code, curation hours, compute) are their authors' estimates.

| File | Lens | The headline finding |
|---|---|---|
| [`fun.md`](fun.md) | A designer who has shipped turn-based roguelikes | About 32 systems in a first run, three times SPD's first region; departments should own their systems. Fighting paid nothing. Viewing the Centrepiece dominated fighting it |
| [`pcg.md`](pcg.md) | Julian's own PCG research | Well-founded as engineering, timid as research. The infinity decision omitted its strongest option, now D1(f), the Open Stacks. AI&G 2e p. 300 was misread. Research angles, ranked |
| [`museal.md`](museal.md) | A curator who loves Calvino, Borges and the Museum of Jurassic Technology, and who has worked on decolonising collections | One register everywhere ("Office" 131 times). The attribution ladder ran backwards. Provenance had no v1 mechanic. Staff should never be harmed, including the Registrar. No frame voice |
| [`feasibility.md`](feasibility.md) | A technical lead building this in this repo with AI assistants | 50,000–70,000 lines as drafted, with no production plan. A three-department slice, milestones with acceptance tests, and 20 technical claims checked |
| [`consistency.md`](consistency.md) | An editor checking that seven drafts are one design | Two rulebooks; three gate tables; a run 1 that cannot be built. The full disagreement tables and a glossary of overloaded terms |
| [`newplayer.md`](newplayer.md) | A UX designer playing on a 390×844 phone | Nothing teaches the shared systems; the label strip cannot hold its promise; threats are bigger than the screen; colours collide. An onboarding and progressive-disclosure plan |

## Errata

Found in a verification pass over `DESIGN.md` on 20 October 2026. The critiques are left as written; `DESIGN.md` carries the corrections.

- **`pcg.md` M1** says p. 300 of AI&G 2e is "about whole-game rule generation". The passage closes §9.5, *Rules and Mechanics*, and is about the video-game rule generators listed just before it; whole-game generation is §9.6. Its conclusion, that p. 300 does not rule out generated rules, stands. The m1 table repeats "whole video games" and says the page praises Mechanic Miner; the page counts Mechanic Miner among the video-game rule generators that have not yet produced games anyone but their makers would want to play.
- **`pcg.md` §4**, the "good new departments" table, labels its columns "Run 5 / Run 10 / Run 20". The values are for the run *after* 5, 10 and 20 runs. Its hybrid row also counts 8 curated departments plus 2 generated ones in an 8-department run; with 6 curated plus 2 generated, the row reads 3.3–3.8, 1.9–2.4 and 1.4–1.9.
- **`feasibility.md`, technical claim 4**, calls `tech-art.md`'s Sonnet 5.5 cache-read price of $0.10 wrong and gives $0.20. The $0.20 came from a stale cached table; Anthropic's pricing page gives $0.10 (0.05× input). No design decision depends on it.
- **`feasibility.md` §1.2** gives "about 8,000 words of barks". That is the meta draft's whole writing budget; the barks are about 4,200 of it.
- **`feasibility.md`** gives the curation estimate as 20–30 hours per 48-candidate batch in its summary and 15–25 in MAJOR 3. `DESIGN.md` uses 15–30.
- **`pcg.md` M1** repeats the vocabulary draft's "a given signature module appears in only about 49% of runs". That holds for 13 modules over 30 departments; at v1's 8, with a signature module in about 3.75 of 30 departments, it is about seven runs in ten.
