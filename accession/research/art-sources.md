# ACCESSION art: bigger sprites, open image models, downloaded art

*Research and a time-boxed probe, 23 October 2026, answering: "What if we have bigger sprites and use some open-source model to generate them? Or download them from somewhere?" Nothing in the repository was changed. In this report, `art/` means [`../prototypes/art-probe/diffusion/`](../prototypes/art-probe/diffusion/), where the scripts, the manifest, the contact sheet, the phone mock-up and the downscaled sprites are kept; the raw 768-px images and the downloaded Kenney pack were not. Web sources were read on 23 October 2026 unless dated otherwise.*

## Short answer

- **Bigger sprites do not show more of the museum, and on a phone their extra detail is mostly invisible.** The art's size only sets the detail inside a tile. At 12 tiles across, a 48-px art pixel is 0.11 mm wide, near the limit of eyesight. The pixels to draw and animate grow ×4 at 32 px and ×9 at 48 px.
- **Open models draw plausible objects, often not the one asked for.** In the CPU probe (SDXL 1.0 with a pixel-art LoRA) the six prompts gave:
  - two usable: moth, crane;
  - two wrong readings: a post, a dog with a saddlebag;
  - two failures: a doorway in a wall, a sprite-sheet grid.

  A second seed repeated the doorway. The good ones read at real phone size at 32×32 but need cleanup.
- **CC0 packs suit a public MIT repository but are generic fantasy art.** Museum packs are paid and forbid redistribution; one forbids use "alongside 'AI' generated imagery".
- **Recommendation: keep the plan.** Draw 16×16 art in code. Generate offline only as reference for Centrepieces and close-ups, with an Apache-2.0 model on a GPU or hosted API. Use CC0 for placeholders. Start an asset ledger now.

## 1. Sprite size on a phone

**Assumptions.** The arithmetic is mine. The screen is iPhone 14-class: 1170×2532 device pixels at 460 ppi ([Apple](https://support.apple.com/en-us/111850)), so 1 CSS px is 3 device px, or 0.166 mm. The world view is assumed to be 700 CSS px tall, after the top bar, tombstone strip and bottom bar of `design/core-systems.md` §13.1. Department sizes are the brief's 37×20 to 43×33 (compare `design/layout.md` §17.1). Zoom is an integer number of device pixels per art pixel.

| Art px × zoom | Tile (CSS px) | Tiles visible | Share of 37×20 / 43×33 | One art pixel |
|---|---|---|---|---|
| 16 × 4 | 21 | 18×32 | 49% / 41% | 0.22 mm |
| **16 × 6** (plan) | **32** | **12×21** | **32% / 18%** | 0.33 mm |
| 32 × 3 | 32 | 12×21 | 32% / 18% | 0.17 mm |
| 48 × 2 | 32 | 12×21 | 32% / 18% | 0.11 mm |
| 16×9, 24×6, 48×3 | 48 | 8×14 | 15% / 8% | 0.50, 0.33, 0.17 mm |

**What the table shows.**
- **The view depends only on the tile's CSS size, not on the art.**
- **Tap targets.** WCAG 2.2 asks for 44×44 CSS px at AAA ([SC 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)) and 24×24 at AA ([SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). Apple's 44 pt is from secondary sources. A 32-px tile passes AA. 44-px tiles allow at most 8 across, showing 8–15% of a department. Comfortable tapping is therefore a zoom setting, as `review/newplayer.md` M4 proposes, not an art size.
- **Detail.** At 30 cm, 0.11 mm is about 1.3 arcminutes; normal acuity is about 1 (general knowledge). At 12 across, most of 48-px art's extra detail is lost. Larger art pays off only at 8 across or fewer, or on a Mac, where a 1280×720 window shows about 40×20 tiles.
- **Workload.** A frame has 256, 576, 1,024 or 2,304 cells at 16, 24, 32 or 48 px. That multiplies LLM-grid tokens and errors, cleanup, and every animation frame, and gives frames and species more room to drift. Animation in code (`research/tech-art.md` F10) works at any size; hand-drawn frames do not scale cheaply.

## 2. Open image models in 2026

"CPU here" means this machine: 4 cores, 15 GB RAM, no GPU. Licences were read from Hugging Face cards and licence files unless marked.

| Model (date) | Weights licence | Outputs | Size / hardware | CPU here |
|---|---|---|---|---|
| SD 1.5 (2022) | CreativeML OpenRAIL-M | No licensor claim (same clause as ++M; not re-read) | 0.9B | Feasible |
| **SDXL 1.0** (Jul 2023) | Open RAIL++-M (26 Jul 2023). Commercial use is allowed; the Attachment A use restrictions must be passed on. The card still says "intended for research purposes only" | "Licensor claims no rights in the Output" (§III) | 2.6B UNet | **Ran, 93–267 s per image** |
| SDXL-/SD-Turbo, SD 3.5 (2023–24) | Stability AI Community License (5 Jul 2024; read for SDXL-Turbo, assumed for the others). Free below US$1M revenue; commercial users must register and show "Powered by Stability AI" when distributing | "You own" outputs; they may not be used to train a foundation model | 0.9–8.1B | Turbo feasible |
| FLUX.1 [schnell] (Aug 2024) | Apache-2.0 | Free | 12B | No |
| FLUX.1 [dev] | Non-commercial licence v1.1.1 | Outputs may be used commercially, but not to train a competing model | 12B | No |
| **FLUX.2 [klein] 4B** (14 Jan 2026) | Apache-2.0 (the 9B and [dev] are non-commercial) | Free | About 13 GB VRAM | No |
| FLUX 3 Image Klein (13–15 Oct 2026) | "FLUX Kommunity License", gated. The press reports free commercial use below US$5M; **text not read** | ? | 5.6B; int8 builds for 8 GB GPUs | No |
| **Z-Image-Turbo** (Nov 2025) | Apache-2.0 | Free | 6B, "16G VRAM" | No |
| Qwen-Image / -2512 (2025) | Apache-2.0; but **Qwen-Image-2.1** (Sep 2026) is under the Qwen *Research* License, non-commercial | — | 20B / 7B | No |
| GLM-Image (Jan 2026), MOSS-Image (Oct 2026) | MIT, Apache-2.0 (from Hugging Face tags; cards not read) | ? | 6.9B, 5.1B | No |

**The pixel-art LoRA.** The usual pixel-art add-on is `nerijs/pixel-art-xl` (OpenRAIL-M). Its own safetensors metadata names the training set: `pixelbuildings128`, 23 images × 50 repeats, captioned "a red couch", "a wooden barrel" and so on, finished 20 July 2023. Nowhere does it say where those 23 images came from.

**Control and consistency.**
- **Palette quantisation and block-vote downscaling** (tried in §5) unify different generations.
- **ControlNet** ([arXiv:2302.05543](https://arxiv.org/abs/2302.05543)) could hold each image to the game's archetype silhouette.
- **IP-Adapter** ([arXiv:2308.06721](https://arxiv.org/abs/2308.06721)) could take the game's sprites as style reference.
- **LCM-LoRA** ([arXiv:2311.05556](https://arxiv.org/abs/2311.05556)) cuts the step count.
- **Seeds.** Diffusers warns identical output "is not *guaranteed*" ([docs](https://huggingface.co/docs/diffusers/using-diffusers/reusing_seeds)), so outputs must be stored, as DESIGN §12.3 found for text.
- **Animation.** Consistent sprite sheets remain the weak point (CrawLLM, `research/tech-art.md` F9). I found no open model that does it; dedicated tools offer it only hosted.

**Dedicated tools.**
- **PixelLab** ([terms](https://www.pixellab.ai/termsofservice), 23 Nov 2025): "You retain ownership". Outputs may be used for anything except training other models; users must also comply with Open RAIL-M terms (§4.1). The model is not named; prices are unverified.
- **Retro Diffusion** ([site](https://retrodiffusion.ai/)): output "is yours to use for personal or commercial projects", credits from $5. Its [itch.io page](https://astropulse.itch.io/retrodiffusion) claims training "on licensed assets … with their consent" (a vendor claim).

**Hosted inference** (about 1 MP per image):
- Replicate: FLUX.1 [schnell] "$3 per thousand output images" ([pricing](https://replicate.com/pricing)).
- fal.ai: [schnell] $0.003/MP; FLUX.2 [klein] 4B and Z-Image-Turbo $0.005/MP.
- Hugging Face: provider prices "with no additional fees" ([docs](https://huggingface.co/docs/inference-providers/pricing)).

Four candidates for each of 1,000 exhibits cost about $12–20. Curation, not money, is the constraint.

## 3. Downloadable art

**CC0 packs** are safe in a public repository.
- **Kenney.** Tiny Dungeon 1.0 (downloaded): "Creative Commons Zero, CC0 … free to use in personal, educational and commercial projects", credit "not mandatory". 130 tiles of 16×16. The 1-Bit Pack (1,078 files) and Roguelike Indoors (480) are also CC0.
- **Dungeon Crawl Stone Soup, 32×32** ([OpenGameArt](https://opengameart.org/content/dungeon-crawl-32x32-tiles)): CC0, over 3,000 tiles. Its exporter's [README](https://github.com/crawl/tiles) is a provenance lesson. It includes only artists who "signed off their copyright", and excludes 127 tiles whose authors were "unable to be reached".
- **0x72's DungeonTileset II** ([itch.io](https://0x72.itch.io/dungeontileset-ii)): CC0, v1.7, March 2024.

**Museum packs** exist but are paid.
- **KR Art & History Museum** ([itch.io](https://kokororeflections.itch.io/kr-art-history-museum-tileset-for-rpgs); 32/48 px, $16.99): cases, 70+ paintings, statues. Redistribution terms not read.
- **Seliel's Grand Library** (16 px, $14.99): its [Mana Seed licence](https://selieltheshaper.weebly.com/user-license.html) says "You may NOT resell or redistribute (either commercially or freely) my assets". It also refuses use "in a project alongside 'AI' generated imagery, writing, code, or anything else".

**A public repository is redistribution**, and so, arguably, is the single-file `dist/` build, from which embedded art can be extracted. CC0 can go in; CC-BY needs attribution; most paid packs cannot.

**Mismatch.** Tiny Dungeon has wizards, knights, ghosts and potions (contact sheet). Museum packs supply furniture, which code draws cheaply anyway (`research/tech-art.md` F13). No pack has the departments' own exhibits.

## 4. Provenance and ethics

- **The theme makes this matter.** A game about how objects came to a museum should not credit its own pictures as "source unknown".
- **Training data is mostly undisclosed.** SDXL's card describes no data; SD 3.5 says "filtered publicly available data"; the FLUX cards I read are silent. SD 1.5 was trained on LAION subsets; LAION-5B was found in 2023 to link to child sexual abuse material and was re-released cleaned in 2024 ([TechCrunch](https://techcrunch.com/2024/08/30/the-org-behind-the-data-set-used-to-train-stable-diffusion-claims-it-has-removed-csam/)). Only Retro Diffusion claims consent, unverified.
- **Law** (secondary summaries; not legal advice).
  - *Getty v Stability AI* [2025] EWHC 2863 (Ch): secondary infringement through the weights failed; appeal permitted December 2025 ([Bird & Bird](https://cm.twobirds.com/en/insights/2025/uk/stability-ai-defeats-getty-images-copyright-claims-in-first-of-its-kind-dispute-before-the-high-cour)).
  - The US Copyright Office (January 2025): prompts alone do not make an author ([summary](https://copyrightalliance.org/ai-report-part-2-copyrightability/)). Generated sprites and LLM-written grids are probably not copyrightable; MIT covers only the human or code changes.
  - Steam asks for disclosure of AI-generated content (Valve's text not read).
- **An asset ledger.** Following `grift-city/tools/assets/SOURCES.md`, keep `art/ledger.json` with one row per image:
  - id, file, sha256;
  - kind: code, LLM grid, diffusion, downloaded or human;
  - creator, or model, version, weights commit and tools;
  - prompt, seed, validator version;
  - SPDX licence, source URL, retrieval date, a copy of the licence;
  - changes;
  - TASL attribution, which CC-BY 4.0 §3(a) requires with "indicate if You modified";
  - status: placeholder or shipped.

  The build fails on any image without a row; the credits are generated from it, perhaps as the museum's accession register.

## 5. The probe

**Setup.**
- **Model.** The Apache-2.0 models above need more than 15 GB just for bf16 weights, so I ran the common open pixel-art stack: SDXL base 1.0 (`4621659…`), LCM-LoRA SDXL (`a18548d…`) and Pixel Art XL (`8bf4a4d…`), fused at 1.0 and 1.2. Sampling: LCM, 6 steps, guidance 1.0, 768×768, fp16 safetensors run in fp32 (torch 2.14.1+cpu, diffusers 0.41.0).
- **Memory.** A first run, with classifier-free guidance and VAE decoding alongside the UNet, ran out of memory at 13.7 GB. The working run keeps only latents while the UNet runs and decodes afterwards; it peaked at 13.5 GB.
- **Time.** Typically 93–99 s per image; the first three took 185–267 s (contention, not investigated). Disk: 7.0 GB of weights plus a 1.3 GB venv, deleted afterwards.
- **Prompt.** "pixel art, ⟨subject⟩, single object, centered, full view, plain white background, game sprite". Prompts, seeds, times and hashes are in `art/manifest.json`.
- **Post-processing** (`art/scripts/postprocess.py`): flood-fill the background from the border, crop, map to a fixed 16-colour "museum materials" palette (CIELAB), downscale to 48, 32 and 16 px by block vote, optionally add a 1-px outline.

**Results** (`art/contact_sheet.png`, `art/phone_mockup_390x844_dpr3.png`):

| Subject | Seed 101 | Seed 202 |
|---|---|---|
| pinned moth | Clear moth, wings spread; no pin. **Usable** | — |
| harbour crane | Toy crane on a blue base. **Usable**; the background trapped inside the jib survived my fill | — |
| clockwork hound | Brown dog wearing a machine saddle: wrong reading | An ordinary brown dog of another breed |
| bronze bollard | Tall turned post with a teal cap: wrong reading | Short stout post: close to a bollard |
| marble doorstep | Doorway with steps in a brick wall: **failed** | Doorway again: **failed**, a systematic misreading |
| bell on a float | Grid of small red objects (a sprite sheet) plus a buoy: **failed** | — |

**Judgement.**
- **Readability at real size.** The LoRA and palette give a coherent look. At 32-px tiles, the 32×32 moth, crane and hound read clearly; at 48×48 the extra detail does not show. At 16×16 the hound becomes a blob, while the code-drawn sprites stay crisp because they were designed at that size.
- **Consistency is weak.** Scale varies by subject; drop shadows are baked in and would fight the light pools; seeds give different species; nothing ties a silhouette to an archetype.
- **Cleanup.** Each usable sprite needs its shadow removed, mask holes fixed, proportions corrected, outline redrawn and colours mapped to ramp slots for department palettes. I estimate 10–30 minutes per static 32×32 sprite (not measured). Animation frames would be nearly redrawn.
- **Yield.** About one candidate in three is worth cleaning.

## 6. Four options

| | A. Code-drawn 16 px (plan) | B. Generated 32/48 px | C. Downloaded CC0 | D. Hybrid |
|---|---|---|---|---|
| Fits each department's topic | Yes (LLM grid, archetype fallback) | Sometimes (2 of 6) | No | Yes |
| Readable at 12 across | Yes | 32: yes; 48: detail wasted | Yes | Yes |
| Department palettes | Indexed, built in | Needs remapping | Needs recolouring | Built in |
| Animation | In code | Hard | Some packs | In code |
| Reproducible | Fully | Only by storing outputs | Fully | Fully |
| In a public MIT repo | Clean | Weights terms apply; outputs probably not copyrightable | CC0 clean; paid packs not | Clean |
| Explainable provenance | Full | Opaque training data | Mostly clear | Through the ledger |
| Cost | Authoring time | $0.003–0.005 per image or a 16 GB GPU, plus cleanup | Free | Small |

## 7. Recommendation

1. **Keep 16×16 tiles drawn in code at 32 CSS px (12 across), with zoom steps of 21, 32 and 43 px on a DPR-3 phone.** Do not move to 32- or 48-px art: on a phone it costs ×4 to ×9 and the benefit cannot be seen.
2. **Use larger art only where the screen has room:** 2×2-tile Centrepieces, and 64×64 close-ups on the label panel. There, an Apache-2.0 model (FLUX.2 [klein] 4B or Z-Image-Turbo, hosted or on a 16 GB GPU) can supply references. Use ControlNet on the archetype silhouette and IP-Adapter on the game's own sprites. Code quantises the result to ramp slots, and a person approves it.
3. **Use CC0 art only as placeholders,** listed in the ledger. Buy itch.io packs only if their licence allows source redistribution and AI-adjacent use.
4. **Start the ledger and its build check now, LLM grids included.**

## 8. What I could not verify

- **Not read:** the FLUX Kommunity License text (gated), PixelLab's prices, the KR pack's terms, and the GLM-Image, MOSS-Image and Krea 2 cards.
- **Secondary sources only:** Apple's 44 pt, Valve's current AI rules, and the status of the Getty appeal.
- **Open questions:** whether an embedded copy in `dist/` counts as redistribution, and Retro Diffusion's consent claim.
- **Estimates:** the hardware needs of the 4–20B models and the cleanup times.
- **The probe's limits:** one model, nine images, judged by me, not by people. Its naive background fill causes some artefacts.
