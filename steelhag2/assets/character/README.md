# Character sources

Authored mesh, skeleton and animations: **Quaternius**, Ultimate Modular Men Pack (February 2022), **CC0 1.0 Universal**.

- Artist and license: https://quaternius.com/packs/ultimatemodularcharacters.html
- Hoodie: https://poly.pizza/m/gKLBoRsyKe
- Business Man / trousers: https://poly.pizza/m/JFrLIKqvCH
- CC0: https://creativecommons.org/publicdomain/zero/1.0/
- Unmodified GLB mirrors retrieved from https://github.com/CODE-MEDI-2026-1TEAM/CODE-MEDI-2026-1TEAM/tree/main/frontend/public/models/patients (Man4.glb and Man2.glb). The artist's original Drive downloads were quota limited at retrieval.

The game combines the hooded upper body and head with long trousers and shoes. Material colours are adapted to rust outerwear, dark gloves and slate trousers; original animation data and four-weight skinning are preserved. Field pack and lamp are original equipment attachments.

Recompile from the repository root:

```sh
python3 steelhag2/tools/import-character.py steelhag2/assets/character/hoodie-source.glb steelhag2/assets/character/trousers-source.glb steelhag2/js/character-data.js
```

The JS asset is embedded in standalone builds; no network requests or CDN dependencies are needed to play.
