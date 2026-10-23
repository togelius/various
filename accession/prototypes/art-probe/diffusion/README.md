# Diffusion art probe (23 October 2026)

Research material for `research/art-sources.md`, not game art. Nothing here may ship without an entry in the asset ledger.

**Provenance of these images:**
- **Base model:** Stable Diffusion XL 1.0 (Stability AI, CreativeML Open RAIL++-M). Its training data is not described on its model card.
- **Add-ons:** the LCM-LoRA for SDXL (Latent Consistency), and the `nerijs/pixel-art-xl` LoRA. The pixel-art LoRA's own metadata says it was trained on 23 images, with no stated source.
- **Kenney row:** the contact sheet's last row is Kenney's *Tiny Dungeon* pack, CC0 1.0.
- **Records:** prompts, seeds, weight revisions and timings are in `manifest.json` and `gen_log.jsonl`.
- **Not kept:** the raw 768-pixel images and the model weights. `scripts/fetch_models.py` and `scripts/gen.py` regenerate them, though diffusion output can differ between machines.
