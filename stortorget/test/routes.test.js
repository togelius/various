"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const routes = require("../js/routes.js");

const SPAWNS = {
  sodergatan: { x: 289, y: 594 },
  baltzarsgatan: { x: 503, y: 390 },
  lillatorg: { x: 0, y: 548 },
  norravallgatan: { x: 0, y: 228 },
  djaknegatan: { x: 503, y: 190 },
  centralen: { x: 331, y: 61 },
};
const EPSILON = 1e-7;
const graphEdges = routes.getGraphEdges();
const graphSegmentKeys = new Set();
const graphAdjacency = new Map();

function coordinateKey(point) {
  return `${point.x},${point.y}`;
}

function segmentKey(from, to) {
  return `${coordinateKey(from)}>${coordinateKey(to)}`;
}

for (const edge of graphEdges) {
  if (!graphAdjacency.has(edge.from)) graphAdjacency.set(edge.from, []);
  if (!graphAdjacency.has(edge.to)) graphAdjacency.set(edge.to, []);
  graphAdjacency.get(edge.from).push({ to: edge.to, length: edge.length });
  graphAdjacency.get(edge.to).push({ to: edge.from, length: edge.length });
  for (let index = 0; index < edge.points.length - 1; index += 1) {
    const from = edge.points[index];
    const to = edge.points[index + 1];
    graphSegmentKeys.add(segmentKey(from, to));
    graphSegmentKeys.add(segmentKey(to, from));
  }
}

function independentShortestDistance(entryId) {
  const distances = new Map([[entryId, 0]]);
  const visited = new Set();
  while (true) {
    let current = null;
    let best = Infinity;
    for (const [node, distance] of distances) {
      if (!visited.has(node) && distance < best) {
        current = node;
        best = distance;
      }
    }
    if (current === null || current === "statue") return best;
    visited.add(current);
    for (const edge of graphAdjacency.get(current) || []) {
      const candidate = best + edge.length;
      if (candidate < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, candidate);
      }
    }
  }
}

function assertRoute(route, entryId, randomized) {
  assert.equal(route.entryId, entryId);
  assert.equal(route.randomized, randomized);
  assert.equal(typeof route.id, "string");
  assert.ok(route.id.length > entryId.length);
  assert.equal(typeof route.name, "string");
  assert.match(route.color, /^#[0-9a-f]{6}$/);
  assert.ok(Array.isArray(route.points));
  assert.ok(route.points.length >= 2);
  assert.deepEqual(route.points[0], SPAWNS[entryId]);
  assert.deepEqual(route.points.at(-1), routes.STATUE);
  assert.equal(route.segments.length, route.points.length - 1);
  assert.ok(Number.isFinite(route.baseLength));
  assert.ok(route.baseLength > 0);
  assert.ok(Number.isFinite(route.length));
  assert.ok(route.length > 0);

  const visitedPoints = new Set();
  for (const point of route.points) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(point.x >= 0 && point.x <= 503, `x out of bounds: ${point.x}`);
    assert.ok(point.y >= 0 && point.y <= 594, `y out of bounds: ${point.y}`);
    const key = coordinateKey(point);
    assert.ok(!visitedPoints.has(key), `repeated route node ${key}`);
    visitedPoints.add(key);
  }

  let elapsed = 0;
  route.segments.forEach((segment, index) => {
    assert.deepEqual(segment.from, route.points[index]);
    assert.deepEqual(segment.to, route.points[index + 1]);
    assert.equal(segment.start, elapsed);
    assert.ok(Number.isFinite(segment.length) && segment.length > 0);
    const geometryLength = Math.hypot(
      segment.to.x - segment.from.x,
      segment.to.y - segment.from.y,
    );
    assert.ok(Math.abs(segment.length - geometryLength) <= EPSILON);
    assert.ok(
      graphSegmentKeys.has(segmentKey(segment.from, segment.to)),
      `route left the authored graph at ${segmentKey(segment.from, segment.to)}`,
    );
    elapsed += segment.length;
  });
  assert.equal(route.length, elapsed);
  if (randomized) {
    assert.ok(
      route.length <= route.baseLength * 1.65 + EPSILON,
      `${route.id}: ${route.length} exceeds 1.65 × ${route.baseLength}`,
    );
  } else {
    assert.ok(Math.abs(route.length - route.baseLength) <= EPSILON);
  }
}

test("UMD exports a browser global and never uses Math.random", () => {
  const filename = path.join(__dirname, "../js/routes.js");
  const source = fs.readFileSync(filename, "utf8");
  assert.ok(!source.includes("Math.random"));
  const context = {};
  vm.runInNewContext(source, context);
  assert.ok(context.StortorgetRoutes);
  assert.equal(typeof context.StortorgetRoutes.makeRandomRoute, "function");
  assert.equal(typeof context.StortorgetRoutes.getShortestRoute, "function");
});

test("seeded RNG is deterministic and stays in [0, 1)", () => {
  const first = routes.createRng("stortorget-seed");
  const second = routes.createRng("stortorget-seed");
  const other = routes.createRng("another-seed");
  let differs = false;
  for (let index = 0; index < 1000; index += 1) {
    const value = first();
    assert.ok(value >= 0 && value < 1);
    assert.equal(value, second());
    if (value !== other()) differs = true;
  }
  assert.ok(differs);
});

test("graph edges are finite, nonzero, uniquely identified, and in bounds", () => {
  assert.ok(graphEdges.length >= 30);
  const ids = new Set();
  for (const edge of graphEdges) {
    assert.equal(typeof edge.id, "string");
    assert.ok(!ids.has(edge.id));
    ids.add(edge.id);
    assert.equal(typeof edge.from, "string");
    assert.equal(typeof edge.to, "string");
    assert.notEqual(edge.from, edge.to);
    assert.ok(edge.points.length >= 2);
    assert.ok(edge.length > 0 && Number.isFinite(edge.length));
    let length = 0;
    for (let index = 0; index < edge.points.length; index += 1) {
      const point = edge.points[index];
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.x >= 0 && point.x <= 503);
      assert.ok(point.y >= 0 && point.y <= 594);
      if (index) {
        const previous = edge.points[index - 1];
        length += Math.hypot(point.x - previous.x, point.y - previous.y);
      }
    }
    assert.ok(Math.abs(length - edge.length) <= EPSILON);
  }
});

test("all shortest routes are valid and match independent graph distances", () => {
  assert.deepEqual([...routes.ENTRY_IDS], Object.keys(SPAWNS));
  assert.deepEqual(routes.STATUE, { x: 244.4, y: 269.5 });
  for (const entryId of routes.ENTRY_IDS) {
    const route = routes.getShortestRoute(entryId);
    assertRoute(route, entryId, false);
    const expected = independentShortestDistance(entryId);
    assert.ok(Number.isFinite(expected));
    assert.ok(Math.abs(route.length - expected) <= EPSILON, entryId);
    assert.deepEqual(routes.getShortestRoute(entryId), route);
  }
});

test("120 randomized routes per entry are connected, simple, bounded, and varied", () => {
  for (const entryId of routes.ENTRY_IDS) {
    const rng = routes.createRng(`routes-${entryId}`);
    const shortest = routes.getShortestRoute(entryId);
    const signatures = new Set();
    const ids = new Set();
    for (let index = 0; index < 120; index += 1) {
      const route = routes.makeRandomRoute(entryId, rng);
      assertRoute(route, entryId, true);
      assert.ok(Math.abs(route.baseLength - shortest.baseLength) <= EPSILON);
      signatures.add(JSON.stringify(route.points));
      ids.add(route.id);
    }
    assert.equal(ids.size, 120, `${entryId} debugging IDs should be unique within a stream`);
    assert.ok(signatures.size >= 2, `${entryId} produced only one route geometry`);
  }
});

test("the same seed and entry sequence reproduce complete route objects", () => {
  const sequence = [
    "sodergatan", "lillatorg", "centralen", "sodergatan",
    "djaknegatan", "baltzarsgatan", "norravallgatan", "lillatorg",
    "centralen", "djaknegatan", "sodergatan", "baltzarsgatan",
  ];
  const first = routes.createRng(20261030);
  const second = routes.createRng(20261030);
  for (let repeat = 0; repeat < 5; repeat += 1) {
    for (const entryId of sequence) {
      assert.deepEqual(
        routes.makeRandomRoute(entryId, first),
        routes.makeRandomRoute(entryId, second),
      );
    }
  }
});

test("different seeds alter generated geometry for at least one entry", () => {
  const first = routes.createRng("first-run");
  const second = routes.createRng("second-run");
  let differs = false;
  for (let index = 0; index < 24; index += 1) {
    for (const entryId of routes.ENTRY_IDS) {
      const a = routes.makeRandomRoute(entryId, first);
      const b = routes.makeRandomRoute(entryId, second);
      if (JSON.stringify(a.points) !== JSON.stringify(b.points)) differs = true;
    }
  }
  assert.ok(differs);
});

test("Lilla Torg can use Skomakaregatan instead of its original square approach", () => {
  const alternate = graphEdges.find((edge) => edge.id === "skomakaregatan");
  assert.ok(alternate, "Skomakaregatan must be an authored graph edge");
  assert.equal(alternate.from, "lilla-torg-south");
  assert.equal(alternate.to, "soder-baltzar");

  const rng = routes.createRng("find-skomakaregatan");
  let found = null;
  for (let index = 0; index < 120 && !found; index += 1) {
    const route = routes.makeRandomRoute("lillatorg", rng);
    if (route.points.some((point) => point.x === 250 && point.y === 386)) {
      found = route;
    }
  }
  assert.ok(found, "randomized Lilla Torg routes should be able to use Skomakaregatan");
  assertRoute(found, "lillatorg", true);
  assert.ok(!found.points.some((point) => point.x === 179 && point.y === 346));
});
