(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StortorgetMapStyle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Repaints the OpenStreetMap render as an illustrated old town: each pixel is
  // classified by its OSM colour, labels and icons are filled in from their
  // surroundings, and the classes are drawn back up at a higher resolution as
  // tiled roofs with front walls and shadows, cobbled streets, stone quays and
  // parks with trees. Street names come back as crisp text at draw time.

  const UNKNOWN = 0;
  const GROUND = 1;
  const STREET = 2;
  const MAIN = 3;
  const PLAZA = 4;
  const BUILDING = 5;
  const SEAM = 6;
  const WATER = 7;
  const PARK = 8;
  const CLASSES = { UNKNOWN, GROUND, STREET, MAIN, PLAZA, BUILDING, SEAM, WATER, PARK };

  // OSM Carto colours and what they are on this map. A fifth `true` marks the
  // pale land colours that a white label halo over a roof also comes out as.
  const REFERENCES = [
    [0xfc, 0xfc, 0xfc, STREET], [0xff, 0xff, 0xff, STREET],
    [0xf7, 0xfa, 0xbf, MAIN],
    [0xf2, 0xef, 0xe9, GROUND, true], [0xe0, 0xdf, 0xdf, GROUND, true], [0xff, 0xd6, 0xd1, GROUND],
    [0xf2, 0xda, 0xd9, GROUND], [0xe8, 0xd8, 0xe8, GROUND],
    [0xd9, 0xd0, 0xc9, BUILDING], [0xc4, 0xb5, 0xaa, SEAM],
    [0xaa, 0xd3, 0xdf, WATER],
    [0xdd, 0xdd, 0xe8, PLAZA], [0xee, 0xee, 0xee, PLAZA],
    [0xc8, 0xfa, 0xcc, PARK], [0xcd, 0xeb, 0xb0, PARK], [0xad, 0xd1, 0x9e, PARK], [0xaa, 0xcb, 0xaf, PARK],
  ];
  const MATCH_LIMIT = 420; // squared RGB distance; anything further is ink

  // Pixels that are text, icons or footpath dashes become UNKNOWN, and so do
  // pale-land pixels right next to them, which are mostly halos over roofs.
  function classify(data, width, height) {
    const labels = new Uint8Array(width * height);
    const ink = new Uint8Array(width * height);
    const haloLike = new Uint8Array(width * height);
    for (let index = 0; index < width * height; index += 1) {
      const r = data[index * 4];
      const g = data[index * 4 + 1];
      const b = data[index * 4 + 2];
      let best = Infinity;
      let nearest = 0;
      REFERENCES.forEach((reference, referenceIndex) => {
        const distance = (r - reference[0]) ** 2 + (g - reference[1]) ** 2 + (b - reference[2]) ** 2;
        if (distance < best) {
          best = distance;
          nearest = referenceIndex;
        }
      });
      if (best > MATCH_LIMIT) ink[index] = 1;
      else {
        labels[index] = REFERENCES[nearest][3];
        haloLike[index] = REFERENCES[nearest][4] ? 1 : 0;
      }
    }
    const reach = 2;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (!haloLike[index]) continue;
        search: for (let dy = -reach; dy <= reach; dy += 1) {
          for (let dx = -reach; dx <= reach; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (ink[ny * width + nx]) {
              labels[index] = UNKNOWN;
              break search;
            }
          }
        }
      }
    }
    return labels;
  }

  // Every UNKNOWN pixel takes the class of the nearest known pixel.
  function fillUnknown(labels, width, height) {
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    for (let index = 0; index < labels.length; index += 1) if (labels[index] !== UNKNOWN) queue[tail++] = index;
    if (!tail) {
      labels.fill(GROUND);
      return labels;
    }
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const neighbours = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width];
      for (const next of neighbours) {
        if (next < 0 || next >= labels.length || labels[next] !== UNKNOWN) continue;
        labels[next] = labels[index];
        queue[tail++] = next;
      }
    }
    return labels;
  }

  // Buildings separated by seams get their own ids; seams borrow a neighbour's.
  function buildingIds(labels, width, height) {
    const ids = new Int32Array(width * height).fill(-1);
    const sizes = [];
    const stack = [];
    for (let start = 0; start < labels.length; start += 1) {
      if (labels[start] !== BUILDING || ids[start] >= 0) continue;
      const id = sizes.length;
      let size = 0;
      ids[start] = id;
      stack.push(start);
      while (stack.length) {
        const index = stack.pop();
        size += 1;
        const x = index % width;
        for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width]) {
          if (next < 0 || next >= labels.length || ids[next] >= 0 || labels[next] !== BUILDING) continue;
          ids[next] = id;
          stack.push(next);
        }
      }
      sizes.push(size);
    }
    for (let pass = 0; pass < 3; pass += 1) {
      for (let index = 0; index < labels.length; index += 1) {
        if (labels[index] !== SEAM || ids[index] >= 0) continue;
        const x = index % width;
        for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width]) {
          if (next >= 0 && next < labels.length && ids[next] >= 0) {
            ids[index] = ids[next];
            break;
          }
        }
      }
    }
    return { ids, sizes };
  }

  function hash(x, y, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function hex(value) {
    const number = parseInt(value.slice(1), 16);
    return [number >> 16, (number >> 8) & 255, number & 255];
  }

  const ROOFS = ["#b46a4f", "#a35e4a", "#bd7d5e", "#8e5446", "#b0644b", "#7d5a4c", "#6c5d55", "#66727a", "#76818a", "#5a5e66", "#8f918b", "#b89a6c", "#a68a72"].map(hex);
  const FACADES = ["#d9c8a8", "#cfae78", "#d8c391", "#c99178", "#a86450", "#ddd5c6", "#bba78f"].map(hex);
  const COPPER = hex("#6f9e8c");
  const COLORS = {
    [GROUND]: hex("#a3a57e"),
    [STREET]: hex("#f1e7cf"),
    [MAIN]: hex("#cfc5ad"),
    [PLAZA]: hex("#f5ecd6"),
    [PARK]: hex("#8cb862"),
  };
  const WATER_SHALLOW = hex("#5db2c0");
  const WATER_DEEP = hex("#2f7d96");
  const QUAY = hex("#cfc4aa");

  // Distance in pixels to the nearest pixel of a different kind (capped).
  function distanceField(mask, width, height, cap) {
    const distance = new Uint8Array(width * height).fill(cap);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    for (let index = 0; index < mask.length; index += 1) {
      if (!mask[index]) {
        distance[index] = 0;
        queue[tail++] = index;
      }
    }
    while (head < tail) {
      const index = queue[head++];
      const next = distance[index] + 1;
      if (next >= cap) continue;
      const x = index % width;
      for (const neighbour of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width]) {
        if (neighbour < 0 || neighbour >= mask.length || distance[neighbour] <= next) continue;
        distance[neighbour] = next;
        queue[tail++] = neighbour;
      }
    }
    return distance;
  }

  // Draws the classes at `scale` times the source size into an ImageData-sized buffer.
  function paintPixels(labels, ids, sizes, width, height, scale, overrides = []) {
    const W = width * scale;
    const H = height * scale;
    const up = new Uint8Array(W * H);
    const upId = new Int32Array(W * H).fill(-1);
    const weights = new Float32Array(10);
    for (let Y = 0; Y < H; Y += 1) {
      const v = (Y + 0.5) / scale - 0.5;
      const y0 = Math.max(0, Math.min(height - 1, Math.floor(v)));
      const y1 = Math.min(height - 1, y0 + 1);
      for (let X = 0; X < W; X += 1) {
        const u = (X + 0.5) / scale - 0.5;
        const x0 = Math.max(0, Math.min(width - 1, Math.floor(u)));
        const x1 = Math.min(width - 1, x0 + 1);
        const a = labels[y0 * width + x0];
        let kind = a;
        if (!(a === labels[y0 * width + x1] && a === labels[y1 * width + x0] && a === labels[y1 * width + x1])) {
          // A small Gaussian vote over the 4×4 neighbourhood rounds off the
          // stair steps of the source pixels.
          weights.fill(0);
          for (let sy = y0 - 1; sy <= y0 + 2; sy += 1) {
            const cy = Math.max(0, Math.min(height - 1, sy));
            for (let sx = x0 - 1; sx <= x0 + 2; sx += 1) {
              const cx = Math.max(0, Math.min(width - 1, sx));
              weights[labels[cy * width + cx]] += Math.exp(-((sx - u) ** 2 + (sy - v) ** 2) * 0.9);
            }
          }
          let best = -1;
          for (let k = 0; k < weights.length; k += 1) {
            if (weights[k] > best) {
              best = weights[k];
              kind = k;
            }
          }
        }
        const out = Y * W + X;
        up[out] = kind;
        if (kind === BUILDING || kind === SEAM) {
          const sx = Math.max(0, Math.min(width - 1, Math.round(u)));
          const sy = Math.max(0, Math.min(height - 1, Math.round(v)));
          let id = ids[sy * width + sx];
          if (id < 0) id = ids[y0 * width + x0] >= 0 ? ids[y0 * width + x0] : ids[y1 * width + x1];
          upId[out] = id;
        }
      }
    }

    const roofOf = sizes.map((size, id) => {
      const pick = hash(id, size, 7);
      return ROOFS[Math.floor(pick * ROOFS.length)];
    });
    const facadeOf = sizes.map((size, id) => FACADES[Math.floor(hash(id, 3, 11) * FACADES.length)]);
    for (const override of overrides) {
      const id = ids[Math.round(override.y) * width + Math.round(override.x)];
      if (id >= 0) roofOf[id] = override.roof === "copper" ? COPPER : hex(override.roof);
    }

    const solid = (index) => index >= 0 && index < up.length && (up[index] === BUILDING || up[index] === SEAM);
    const lift = Math.max(3, Math.round(scale * 2));
    const waterMask = new Uint8Array(W * H);
    for (let index = 0; index < up.length; index += 1) waterMask[index] = up[index] === WATER ? 1 : 0;
    const shore = distanceField(waterMask, W, H, 40);
    const pixels = new Uint8ClampedArray(W * H * 4);

    for (let Y = 0; Y < H; Y += 1) {
      for (let X = 0; X < W; X += 1) {
        const index = Y * W + X;
        const grain = (hash(X, Y) - 0.5) * 4 + (hash(X >> 4, Y >> 4, 5) - 0.5) * 5;
        let rgb;
        let shade = 1;
        const roofIndex = index + lift * W;
        if (Y + lift < H && solid(roofIndex)) {
          // Roof, lifted above its footprint.
          const id = upId[roofIndex];
          const seam = up[roofIndex] === SEAM;
          rgb = id >= 0 ? roofOf[id] : ROOFS[0];
          if (seam) shade = 0.66;
          else {
            if (!solid(roofIndex - W) || !solid(roofIndex - 2 * W)) shade = 1.14;
            else if (!solid(roofIndex - 1)) shade = 1.07;
            else if (!solid(roofIndex + 1)) shade = 0.88;
          }
        } else if (solid(index)) {
          // Front wall between the roof and the street, darker under the eaves.
          const id = upId[index];
          rgb = id >= 0 ? facadeOf[id] : FACADES[0];
          let row = 0;
          while (row < lift && solid(index + (row + 1) * W)) row += 1;
          shade = row === lift - 1 ? 0.55 : 0.78 + 0.04 * (lift - 1 - row) / lift;
        } else if (up[index] === WATER) {
          const depth = shore[index];
          if (depth <= scale) {
            rgb = QUAY;
            shade = depth === scale ? 0.78 : 1;
          } else {
            const t = Math.min(1, (depth - scale) / (scale * 6));
            rgb = [0, 1, 2].map((channel) => WATER_SHALLOW[channel] + (WATER_DEEP[channel] - WATER_SHALLOW[channel]) * t);
            shade = 1 + (hash(X >> 2, Y >> 1, 3) - 0.5) * 0.05;
          }
        } else {
          const kind = up[index];
          rgb = COLORS[kind] || COLORS[GROUND];
          if (kind === PLAZA && (X % (scale * 4) === 0 || Y % (scale * 4) === 0)) shade = 0.95;
          if (kind === PARK) shade = 1 + (hash(X >> 2, Y >> 2, 4) - 0.5) * 0.12;
          // Cast shadows fall south-east from buildings.
          let shadow = 0;
          for (let step = 1; step <= lift + scale * 2; step += 1) {
            const sx = X - step;
            const sy = Y - Math.round(step * 0.55);
            if (sx < 0 || sy < 0) break;
            if (solid(sy * W + sx)) {
              shadow = 1 - (step - 1) / (lift + scale * 2);
              break;
            }
          }
          shade *= 1 - 0.26 * Math.min(1, shadow * 1.6);
        }
        const out = index * 4;
        pixels[out] = rgb[0] * shade + grain;
        pixels[out + 1] = rgb[1] * shade + grain;
        pixels[out + 2] = rgb[2] * shade + grain * 0.8;
        pixels[out + 3] = 255;
      }
    }
    return { pixels, width: W, height: H, up };
  }

  // Trees for parks and a few points of light on the water, in source pixels.
  function decorations(labels, width, height) {
    const trees = [];
    const sparkles = [];
    for (let y = 2; y < height - 2; y += 3) {
      for (let x = 2; x < width - 2; x += 3) {
        const kind = labels[y * width + x];
        if (kind === PARK && hash(x, y, 21) > 0.55) {
          trees.push({ x: x + hash(x, y, 22) * 2 - 1, y: y + hash(x, y, 23) * 2 - 1, r: 2.4 + hash(x, y, 24) * 2.2 });
        } else if (kind === WATER && hash(x, y, 31) > 0.93) {
          const open = [-3, 3].every((d) => labels[y * width + x + d] === WATER && labels[(y + d) * width + x] === WATER);
          if (open) sparkles.push({ x, y, phase: hash(x, y, 32) * Math.PI * 2, length: 2 + hash(x, y, 33) * 3 });
        }
      }
    }
    return { trees, sparkles };
  }

  function drawTrees(context, trees, scale) {
    context.save();
    context.scale(scale, scale);
    for (const tree of trees) {
      context.fillStyle = "rgba(30, 50, 25, .32)";
      context.beginPath();
      context.arc(tree.x + tree.r * 0.45, tree.y + tree.r * 0.4, tree.r, 0, Math.PI * 2);
      context.fill();
    }
    for (const tree of trees) {
      const gradient = context.createRadialGradient(tree.x - tree.r * 0.4, tree.y - tree.r * 0.45, tree.r * 0.1, tree.x, tree.y, tree.r);
      gradient.addColorStop(0, "#9fd06a");
      gradient.addColorStop(0.55, "#5f9a45");
      gradient.addColorStop(1, "#3f7535");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  // Turns a loaded map image into { canvas, scale, backdrop, sparkles }.
  // Throws if the pixels cannot be read (some file:// setups); callers fall back.
  function paint(image, options = {}) {
    const scale = options.scale || 3;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;
    const sourceContext = source.getContext("2d", { willReadFrequently: true });
    sourceContext.drawImage(image, 0, 0);
    const data = sourceContext.getImageData(0, 0, width, height).data;
    const labels = fillUnknown(classify(data, width, height), width, height);
    const { ids, sizes } = buildingIds(labels, width, height);
    const painted = paintPixels(labels, ids, sizes, width, height, scale, options.roofs || []);
    const canvas = document.createElement("canvas");
    canvas.width = painted.width;
    canvas.height = painted.height;
    const context = canvas.getContext("2d");
    context.putImageData(new ImageData(painted.pixels, painted.width, painted.height), 0, 0);
    const { trees, sparkles } = decorations(labels, width, height);
    drawTrees(context, trees, scale);

    // A tiny copy, drawn large, makes a soft blurred backdrop around the map.
    const backdrop = document.createElement("canvas");
    backdrop.width = 40;
    backdrop.height = Math.round(40 * height / width);
    backdrop.getContext("2d").drawImage(canvas, 0, 0, backdrop.width, backdrop.height);
    return { canvas, scale, backdrop, sparkles };
  }

  // Hand-placed names, in map pixels. Districts are serif, streets small caps.
  const LABELS = [
    { text: "Malmö C", x: 272, y: 31, angle: 0, kind: "district" },
    { text: "NORRA VALLGATAN", x: 318, y: 118, angle: -0.19, kind: "street" },
    { text: "Gamla staden", x: 228, y: 402, angle: 0, kind: "district" },
    { text: "Lilla Torg", x: 176, y: 352, angle: 0, kind: "square" },
    { text: "STORA NYGATAN", x: 312, y: 487, angle: -0.13, kind: "street" },
    { text: "S:t Petri", x: 387, y: 214, angle: 0, kind: "square" },
    { text: "Hamnkanalen", x: 380, y: 76, angle: -0.08, kind: "water" },
  ];

  return { CLASSES, classify, fillUnknown, buildingIds, paintPixels, decorations, paint, LABELS };
});
