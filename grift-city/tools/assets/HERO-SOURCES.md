# Imported protagonist prototype

Quaternius, **Universal Base Characters — Standard**, downloaded 2026-09-23.

- Pack: https://quaternius.com/packs/universalbasecharacters.html
- Download: https://quaternius.itch.io/universal-base-characters
- License: **CC0 1.0 Universal**. The pack's original notice is preserved in `QUATERNIUS-LICENSE.txt`.
- Selected source: Superhero male head/neck and hands; Simple Parted hair; light skin, brown eye and hair base-color textures.

The free Standard download contains athletic bases. This prototype reuses only the authored head, eyes, brows,
hair and hands, retaining Grift City's clothing and 14-bone animation rig. It is not a full-body glTF or animation
retargeting implementation. The neck is clipped and fitted to the jacket collar, hands are rotated/scaled into the
forearm bind space, and diffuse maps are resized to 512 pixels. Original facial features and UVs are retained.

Rebuild from the extracted Standard archive (Python 3 + Pillow):

```sh
python3 tools/assets/import-hero.py '/path/to/Universal Base Characters[Standard]'
python3 tools/build-single.py
```

`js/herodata.js` embeds geometry and textures so the distributed HTML remains self-contained. The archive is
not checked in. Runtime decoding uses typed arrays and the existing mesh builder and texture array; there is
no new runtime library, CDN request, or extra character draw call. The prototype adds about 871 KiB to the
uncompressed release and 9,421 authored triangles to the retained clothing. Authored parts currently retain
full detail in both mesh tiers; this is intended for one protagonist, not a crowd replacement.

Try `test/character-studio.html?mute=1&character=quaternius` for a Current / Imported comparison, or
`dist/grift-city.html?mute=1&character=quaternius` to play. Without the character query, the current hero remains.
The selection is not saved. Facial expression/blinks and individual finger grips remain future rig work.

## Original file SHA-256 checksums

```text
e7fcea214ecf8855afbf910b50de6f9c7d1decfb71ca28bad8a4481452dafeb4  Base Characters/Godot - UE/Superhero_Male_FullBody.gltf
459003f9745853ae562a85506a2b94dd56515c1f37728f9fa3d2ce1a3e4cd92f  Base Characters/Godot - UE/Superhero_Male_FullBody.bin
ce6c666d00bcca2baa0c58d0442505f90f8feff952592effc4697a2341e9e56d  Hairstyles/Origin at 0/glTF (Godot)/Hair_SimpleParted.gltf
57c6359703a37e346ee38a9c7ba55c8dee761c0a02da99847d06f5a91728f3cc  Hairstyles/Origin at 0/glTF (Godot)/Hair_SimpleParted.bin
419f96dbb8811511e2d515bcdabc085ff2f219ec7b8b4e91050a84cba6888fe9  Base Characters/Textures/T_Superhero_Male_Ligh.png
bc7aa863bd22ab0a995cd838cceb4d3a5186ee54ee2fb0108fad85d20c057e6e  Hairstyles/Origin at 0/glTF (Godot)/T_Hair_1_BaseColor.png
d08e3356a83211bc6ca21fe3a8e39f4b5c1a3b8f85457fc2c0fb57be09935025  Base Characters/Godot - UE/T_Eye_Brown.png
```
