"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const levels = require("../js/levels.js");
const MapStyle = require("../js/mapstyle.js");

const { CLASSES } = MapStyle;

// Just enough PNG decoding for the bundled map: 8-bit RGB, not interlaced.
function readPng(file) {
  const bytes = fs.readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  const chunks = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      assert.equal(body[8], 8, "8-bit map expected");
      assert.equal(body[9], 2, "RGB map expected");
    } else if (type === "IDAT") chunks.push(body);
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 3;
  const rgb = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= 3 ? rgb[y * stride + x - 3] : 0;
      const up = y > 0 ? rgb[(y - 1) * stride + x] : 0;
      const corner = x >= 3 && y > 0 ? rgb[(y - 1) * stride + x - 3] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - corner;
        const [a, b, c] = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - corner)];
        predictor = a <= b && a <= c ? left : b <= c ? up : corner;
      }
      rgb[y * stride + x] = (value + predictor) & 255;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = rgb[index * 3];
    data[index * 4 + 1] = rgb[index * 3 + 1];
    data[index * 4 + 2] = rgb[index * 3 + 2];
    data[index * 4 + 3] = 255;
  }
  return { data, width, height };
}

function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return data;
}

test("OSM colours become map classes and labels become unknown", () => {
  const colours = [[0xd9, 0xd0, 0xc9], [0xc4, 0xb5, 0xaa], [0xfc, 0xfc, 0xfc], [0xaa, 0xd3, 0xdf], [0xc8, 0xfa, 0xcc], [0x33, 0x33, 0x33]];
  const labels = MapStyle.classify(image(colours.length, 1, (x) => colours[x]), colours.length, 1);
  assert.deepEqual([...labels], [CLASSES.BUILDING, CLASSES.SEAM, CLASSES.STREET, CLASSES.WATER, CLASSES.PARK, CLASSES.UNKNOWN]);
});

test("label halos over roofs are filled back in from the roof", () => {
  // A roof with a dark glyph and a pale halo around it in the middle.
  const width = 15;
  const height = 9;
  const data = image(width, height, (x, y) => {
    if (x === 7 && y === 4) return [0x33, 0x33, 0x33];
    if (Math.abs(x - 7) <= 2 && Math.abs(y - 4) <= 2) return [0xf2, 0xef, 0xe9];
    return [0xd9, 0xd0, 0xc9];
  });
  const labels = MapStyle.fillUnknown(MapStyle.classify(data, width, height), width, height);
  assert.ok(labels.every((kind) => kind === CLASSES.BUILDING), "the halo should not punch a hole in the roof");
});

test("roofs are lifted above their footprint, leaving a front wall", () => {
  const width = 6;
  const height = 8;
  const labels = new Uint8Array(width * height).fill(CLASSES.STREET);
  for (let y = 3; y < 6; y += 1) for (let x = 1; x < 5; x += 1) labels[y * width + x] = CLASSES.BUILDING;
  const { ids, sizes } = MapStyle.buildingIds(labels, width, height);
  assert.equal(sizes.length, 1);
  const scale = 2;
  const painted = MapStyle.paintPixels(labels, ids, sizes, width, height, scale);
  assert.equal(painted.pixels.length, width * scale * height * scale * 4);
  const pixel = (x, y) => [...painted.pixels.subarray((y * width * scale + x) * 4, (y * width * scale + x) * 4 + 3)];
  const street = pixel(0, 0);
  const aboveFootprint = pixel(5, 3 * scale - 2);
  const bottomOfFootprint = pixel(5, 6 * scale - 1);
  assert.notDeepEqual(aboveFootprint, street, "the roof leans over the street to the north");
  assert.ok(bottomOfFootprint[0] < 230 && bottomOfFootprint.some((channel, index) => Math.abs(channel - aboveFootprint[index]) > 8), "the wall differs from the roof");
});

test("the real map classifies cleanly", () => {
  const map = readPng(path.join(__dirname, "../assets/malmo-map.png"));
  assert.equal(map.width, levels.MAP.width);
  assert.equal(map.height, levels.MAP.height);
  const labels = MapStyle.fillUnknown(MapStyle.classify(map.data, map.width, map.height), map.width, map.height);
  const share = (kind) => labels.filter((value) => value === kind).length / labels.length;
  assert.equal(share(CLASSES.UNKNOWN), 0);
  assert.ok(share(CLASSES.BUILDING) + share(CLASSES.SEAM) > 0.4, "the old town is mostly buildings");
  assert.ok(share(CLASSES.STREET) + share(CLASSES.MAIN) + share(CLASSES.PLAZA) > 0.12, "streets survive the label clean-up");
  assert.ok(share(CLASSES.WATER) > 0.02, "the canal is there");
  assert.ok(share(CLASSES.PARK) > 0.02, "the parks are there");

  // The statue stands in the open square, not on a roof or in the canal.
  const statue = labels[Math.round(levels.STATUE.y) * map.width + Math.round(levels.STATUE.x)];
  assert.ok(![CLASSES.BUILDING, CLASSES.SEAM, CLASSES.WATER].includes(statue), `statue is on class ${statue}`);

  const decorations = MapStyle.decorations(labels, map.width, map.height);
  assert.ok(decorations.trees.length > 50, "parks get trees");
  assert.ok(decorations.sparkles.length > 20, "the canal glints");
});

test("map labels sit on the map", () => {
  for (const label of MapStyle.LABELS) {
    assert.ok(label.x > 0 && label.x < levels.MAP.width && label.y > 0 && label.y < levels.MAP.height, label.text);
  }
});
