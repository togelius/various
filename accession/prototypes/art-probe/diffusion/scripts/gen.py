"""CPU probe: SDXL base 1.0 + LCM-LoRA (SDXL) + Pixel Art XL LoRA, museum-exhibit prompts.

Usage: python -I gen.py MODELDIR OUTDIR RES STEPS GUIDANCE SEEDS(comma) [SUBSET(comma idx)]
Writes OUTDIR/raw/<id>_s<seed>.png and appends one JSON line per image to OUTDIR/gen_log.jsonl.
Weights are read from MODELDIR (safetensors only); nothing is fetched at run time.
"""
import sys, os, json, time, gc, resource
import torch
from diffusers import StableDiffusionXLPipeline, LCMScheduler

MODELDIR, OUT = sys.argv[1], sys.argv[2]
RES, STEPS, GS = int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
SEEDS = [int(s) for s in sys.argv[6].split(',')]
SUBSET = [int(i) for i in sys.argv[7].split(',')] if len(sys.argv) > 7 else None
os.makedirs(os.path.join(OUT, 'raw'), exist_ok=True)
os.environ['HF_HUB_OFFLINE'] = '1'
torch.set_num_threads(4)

BASE = os.path.join(MODELDIR, 'stabilityai__stable-diffusion-xl-base-1.0')
LCM = os.path.join(MODELDIR, 'latent-consistency__lcm-lora-sdxl')
PIX = os.path.join(MODELDIR, 'nerijs__pixel-art-xl')

SUBJECTS = [
    ('doorstep', 'a marble doorstep, a single carved white marble step block'),
    ('bollard', 'a bronze mooring bollard, short and stout, green patina'),
    ('hound', 'a clockwork hound, a brass mechanical dog with gears'),
    ('moth', 'a pinned moth specimen, wings spread, on a pin'),
    ('crane', 'a small model harbour crane, wooden and iron toy model'),
    ('bell', 'a brass bell mounted on a red floating buoy'),
]
TEMPLATE = 'pixel art, {s}, single object, centered, full view, plain white background, game sprite'
NEG = '3d render, realistic, photo, blurry, text, watermark, frame, border, multiple objects, scenery, floor, shadow'

def rss_gb():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6

todo = [(i, sid, s) for i, (sid, s) in enumerate(SUBJECTS) if SUBSET is None or i in SUBSET]

# 1. text encoders only: encode every prompt, then free them
from safetensors.torch import save_file, load_file
t0 = time.time()
cache = os.path.join(OUT, f'prompt_embeds_cfg{int(GS > 1.0)}.safetensors')
flat = load_file(cache) if os.path.exists(cache) else {}
emb = {}
need = [(i, sid, s) for i, sid, s in todo if sid + '.pe' not in flat]
if need:
    te = StableDiffusionXLPipeline.from_pretrained(BASE, unet=None, vae=None, variant='fp16',
                                                   torch_dtype=torch.float32, use_safetensors=True)
    with torch.inference_mode():
        for i, sid, s in need:
            pe, npe, ppe, nppe = te.encode_prompt(prompt=TEMPLATE.format(s=s), device='cpu',
                                                  num_images_per_prompt=1,
                                                  do_classifier_free_guidance=GS > 1.0,
                                                  negative_prompt=NEG)
            flat[sid + '.pe'] = pe.contiguous(); flat[sid + '.ppe'] = ppe.contiguous()
            if GS > 1.0:
                flat[sid + '.npe'] = npe.contiguous(); flat[sid + '.nppe'] = nppe.contiguous()
    del te; gc.collect()
    save_file(flat, cache)
for i, sid, s in todo:
    emb[sid] = (flat[sid + '.pe'], flat.get(sid + '.npe'), flat[sid + '.ppe'], flat.get(sid + '.nppe'))
t_text = time.time() - t0
print(f'text encoding {t_text:.1f}s, peak rss {rss_gb():.1f} GB', flush=True)

# 2. UNet (+VAE kept aside), LoRAs fused; latents first, VAE decode after the UNet is freed
import ctypes
def trim():
    gc.collect()
    try: ctypes.CDLL('libc.so.6').malloc_trim(0)
    except Exception: pass
t0 = time.time()
pipe = StableDiffusionXLPipeline.from_pretrained(BASE, text_encoder=None, text_encoder_2=None,
                                                 tokenizer=None, tokenizer_2=None, variant='fp16',
                                                 torch_dtype=torch.float32, use_safetensors=True)
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
pipe.load_lora_weights(LCM, weight_name='pytorch_lora_weights.safetensors', adapter_name='lcm')
pipe.load_lora_weights(PIX, weight_name='pixel-art-xl.safetensors', adapter_name='pixel')
pipe.set_adapters(['lcm', 'pixel'], adapter_weights=[1.0, 1.2])
pipe.fuse_lora(adapter_names=['lcm', 'pixel'], lora_scale=1.0)
pipe.unload_lora_weights()
trim()
pipe.set_progress_bar_config(disable=True)
t_load = time.time() - t0
print(f'unet load+fuse {t_load:.1f}s, peak rss {rss_gb():.1f} GB', flush=True)

lat = {}
recs = []
for seed in SEEDS:
    for i, sid, s in todo:
        pe, npe, ppe, nppe = emb[sid]
        g = torch.Generator('cpu').manual_seed(seed)
        t0 = time.time()
        with torch.inference_mode():
            z = pipe(prompt_embeds=pe, negative_prompt_embeds=npe if GS > 1.0 else None,
                     pooled_prompt_embeds=ppe, negative_pooled_prompt_embeds=nppe if GS > 1.0 else None,
                     height=RES, width=RES, num_inference_steps=STEPS, guidance_scale=GS,
                     generator=g, output_type='latent').images
        dt = time.time() - t0
        key = f'{sid}_s{seed}'
        lat[key] = z.contiguous()
        save_file(lat, os.path.join(OUT, f'latents_{RES}.safetensors'))
        recs.append(dict(id=sid, file=f'raw/{key}.png', seed=seed, prompt=TEMPLATE.format(s=s),
                         negative_prompt=NEG if GS > 1.0 else None, res=RES, steps=STEPS, guidance=GS,
                         unet_seconds=round(dt, 1), peak_rss_gb=round(rss_gb(), 1)))
        print(json.dumps(recs[-1]), flush=True)

vae = pipe.vae; proc = pipe.image_processor
del pipe; trim()
log = open(os.path.join(OUT, 'gen_log.jsonl'), 'a')
for r in recs:
    key = r['file'][4:-4]
    t0 = time.time()
    with torch.inference_mode():
        img = vae.decode(lat[key] / vae.config.scaling_factor, return_dict=False)[0]
        img = proc.postprocess(img, output_type='pil')[0]
    r['vae_seconds'] = round(time.time() - t0, 1)
    r['seconds'] = round(r['unet_seconds'] + r['vae_seconds'], 1)
    r.update(text_encode_s=round(t_text, 1), load_s=round(t_load, 1), torch=torch.__version__,
             threads=torch.get_num_threads(), peak_rss_gb=round(rss_gb(), 1))
    img.save(os.path.join(OUT, r['file']))
    log.write(json.dumps(r) + '\n'); log.flush()
    print(json.dumps(r), flush=True)
