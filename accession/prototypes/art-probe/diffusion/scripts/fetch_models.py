"""Download only safetensors weights + configs + licence text for the probe."""
import sys, os, time, json
from huggingface_hub import snapshot_download, HfApi
dest = sys.argv[1]
specs = {
  'stabilityai/stable-diffusion-xl-base-1.0': [
     'model_index.json', 'LICENSE.md', 'README.md', 'scheduler/*.json',
     'text_encoder/config.json', 'text_encoder/model.fp16.safetensors',
     'text_encoder_2/config.json', 'text_encoder_2/model.fp16.safetensors',
     'tokenizer/*', 'tokenizer_2/*',
     'unet/config.json', 'unet/diffusion_pytorch_model.fp16.safetensors',
     'vae/config.json', 'vae/diffusion_pytorch_model.fp16.safetensors'],
  'latent-consistency/lcm-lora-sdxl': ['pytorch_lora_weights.safetensors', 'README.md'],
  'nerijs/pixel-art-xl': ['pixel-art-xl.safetensors', 'README.md'],
}
api = HfApi()
log = {}
for rid, pats in specs.items():
    t = time.time()
    info = api.model_info(rid)
    p = snapshot_download(rid, allow_patterns=pats, local_dir=os.path.join(dest, rid.replace('/', '__')))
    bad = [f for r, _, fs in os.walk(p) for f in fs if f.endswith(('.bin', '.ckpt', '.pt', '.pth', '.pkl'))]
    assert not bad, bad
    log[rid] = dict(sha=info.sha, seconds=round(time.time() - t, 1), path=p)
    print(rid, log[rid], flush=True)
json.dump(log, open(os.path.join(dest, 'download_log.json'), 'w'), indent=1)
