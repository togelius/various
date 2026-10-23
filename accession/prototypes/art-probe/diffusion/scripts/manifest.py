"""Assemble art/manifest.json: what was generated, from which weights, under which licences.

Usage: python -I manifest.py ARTDIR
"""
import sys, os, json, hashlib, glob, platform

ART = sys.argv[1]
OUT = os.path.join(ART, 'out')

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()

gen = [json.loads(l) for l in open(os.path.join(OUT, 'gen_log.jsonl'))]
post = json.load(open(os.path.join(OUT, 'sprites', 'postprocess.json')))
dl = json.load(open(os.path.join(ART, 'downloads', 'models', 'download_log.json')))
for k in dl: dl[k].pop('path', None)

m = {
  'probe': 'ACCESSION art probe, 2026-10-23: CPU text-to-image for museum-exhibit sprites',
  'machine': {'cpu': '4-core Intel Xeon @ 2.80GHz (AVX-512, VNNI; no AMX, no AVX512-BF16)', 'ram_gb': 15, 'gpu': None,
              'python': platform.python_version()},
  'weights': {
    'stabilityai/stable-diffusion-xl-base-1.0': dict(dl['stabilityai/stable-diffusion-xl-base-1.0'],
        licence='CreativeML Open RAIL++-M (2023-07-26)', files='fp16 safetensors only (unet, text_encoder, text_encoder_2, vae)',
        url='https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0'),
    'latent-consistency/lcm-lora-sdxl': dict(dl['latent-consistency/lcm-lora-sdxl'], licence='openrail++ (model card tag)',
        url='https://huggingface.co/latent-consistency/lcm-lora-sdxl', adapter_weight=1.0),
    'nerijs/pixel-art-xl': dict(dl['nerijs/pixel-art-xl'], licence='creativeml-openrail-m (model card tag)',
        url='https://huggingface.co/nerijs/pixel-art-xl', adapter_weight=1.2,
        training_data_per_metadata='pixelbuildings128: 23 images x 50 repeats, captions such as "a red couch", "a wooden barrel"; '
                                   'base sdxl_base_v0-9; finished 2023-07-20; image sources not stated'),
  },
  'settings': {'scheduler': 'LCMScheduler', 'steps': 6, 'guidance_scale': 1.0, 'resolution': 768, 'dtype': 'float32',
               'loras': 'fused, then unloaded', 'generator': 'torch.Generator("cpu").manual_seed(seed)'},
  'images': [],
  'palette_16': post['palette'],
  'postprocess': 'scripts/postprocess.py: border flood-fill background, square crop, CIELAB nearest palette colour, '
                 'block-vote downscale to 48/32/16, optional clean (drop isolated pixels, 1-px outline)',
  'cc0_comparison': {'pack': 'Kenney Tiny Dungeon 1.0', 'url': 'https://kenney.nl/assets/tiny-dungeon',
                     'licence': 'CC0 1.0 (License.txt in the pack, copied to out/kenney_tiny-dungeon_License.txt)',
                     'zip_sha256': sha(os.path.join(ART, 'downloads', 'cc0', 'kenney_tiny-dungeon', 'kenney_tiny-dungeon.zip')),
                     'tiles_shown': [84, 96, 121, 122, 110, 65, 63, 89]},
  'outputs': sorted(os.path.relpath(p, ART) for p in glob.glob(os.path.join(OUT, '**', '*.png'), recursive=True)),
}
for r in gen:
    key = r['file'][4:-4]
    r = dict(r)
    r['sha256_raw'] = sha(os.path.join(OUT, r['file']))
    r['postprocess'] = post['images'].get(key)
    r['sprites'] = [f'out/sprites/{key}_{n}.png' for n in ('16', '32', '32clean', '48')]
    m['images'].append(r)
json.dump(m, open(os.path.join(ART, 'manifest.json'), 'w'), indent=1)
print('images', len(m['images']), 'outputs', len(m['outputs']))
