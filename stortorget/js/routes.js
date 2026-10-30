(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.StortorgetRoutes = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const WIDTH = 503;
  const HEIGHT = 594;
  const STATUE = Object.freeze({ x: 244.4, y: 269.5 });
  const ENTRY_IDS = Object.freeze([
    "sodergatan",
    "baltzarsgatan",
    "lillatorg",
    "norravallgatan",
    "djaknegatan",
    "centralen",
  ]);

  const ENTRY_INFO = {
    sodergatan: { name: "Södergatan", color: "#ffd166" },
    baltzarsgatan: { name: "Baltzarsgatan", color: "#ff9f7a" },
    lillatorg: { name: "Lilla Torg", color: "#c7a0ff" },
    norravallgatan: { name: "Norra Vallgatan", color: "#7dd6c2" },
    djaknegatan: { name: "Djäknegatan", color: "#ff8fab" },
    centralen: { name: "Malmö Central", color: "#82baff" },
  };

  // Junctions are shared by edges, while the intermediate points retain the
  // hand-traced street geometry from the six original approaches.
  const NODES = {
    sodergatan: [289, 594],
    "soder-stora-ny": [290, 477],
    "soder-baltzar": [291, 391],
    baltzarsgatan: [503, 390],
    "baltzar-kalende": [366, 390],
    lillatorg: [0, 548],
    "stora-ny-engelbrekt": [169, 520],
    "lilla-torg-south": [177, 371],
    norravallgatan: [0, 228],
    "norra-vaster": [217, 140],
    centralen: [331, 61],
    "norra-adel": [333, 119],
    adelgatan: [338, 170],
    "kyrko-adel": [334, 222],
    djaknegatan: [503, 190],
    "djakne-adel": [441, 190],
    "djakne-sjalbo": [441, 249],
    "kalende-kyrko": [367, 227],
    "norra-djakne": [441, 105],
    "square-se": [291, 307],
    "square-sw": [198, 311],
    "square-nw": [198, 226],
    "square-ne": [292, 222],
    statue: [STATUE.x, STATUE.y],
  };

  function makeEdge(id, from, to, intermediate) {
    const coordinates = [NODES[from], ...(intermediate || []), NODES[to]];
    const points = coordinates.map(([x, y]) => ({ x, y }));
    let length = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      length += Math.hypot(
        points[index + 1].x - points[index].x,
        points[index + 1].y - points[index].y,
      );
    }
    return { id, from, to, points, length };
  }

  const EDGES = [
    // The six original routes.
    makeEdge("sodergatan-south", "sodergatan", "soder-stora-ny", [[288, 558], [288, 521]]),
    makeEdge("sodergatan-middle", "soder-stora-ny", "soder-baltzar", [[290, 435]]),
    makeEdge("sodergatan-north", "soder-baltzar", "square-se", [[291, 349]]),
    makeEdge("square-se-statue", "square-se", "statue", [[277, 292]]),
    makeEdge("baltzarsgatan-east", "baltzarsgatan", "baltzar-kalende", [[461, 390], [414, 390]]),
    makeEdge("baltzarsgatan-west", "baltzar-kalende", "soder-baltzar", [[329, 390]]),
    makeEdge("stora-nygatan-west", "lillatorg", "stora-ny-engelbrekt", [[66, 545], [119, 535]]),
    makeEdge("engelbrektsgatan", "stora-ny-engelbrekt", "lilla-torg-south", [[165, 485], [158, 445], [165, 405]]),
    makeEdge("lilla-torg-approach", "lilla-torg-south", "square-sw", [[179, 346], [188, 330]]),
    makeEdge("square-sw-statue", "square-sw", "statue", [[215, 293]]),
    makeEdge("norra-vallgatan-west", "norravallgatan", "norra-vaster", [[60, 202], [110, 180], [170, 155]]),
    makeEdge("vastergatan", "norra-vaster", "square-nw", [[213, 160], [205, 185], [198, 208]]),
    makeEdge("square-nw-statue", "square-nw", "statue", [[214, 240]]),
    makeEdge("djaknegatan-entry", "djaknegatan", "djakne-adel"),
    makeEdge("djaknegatan-south", "djakne-adel", "djakne-sjalbo", [[441, 224]]),
    makeEdge("sjalbodgatan-east", "djakne-sjalbo", "kalende-kyrko", [[415, 245], [385, 232]]),
    makeEdge("sjalbodgatan-west", "kalende-kyrko", "kyrko-adel", [[351, 225]]),
    makeEdge("kyrkogatan", "kyrko-adel", "square-ne"),
    makeEdge("square-ne-statue", "square-ne", "statue", [[280, 235]]),
    makeEdge("centralbron", "centralen", "norra-adel", [[331, 91]]),
    makeEdge("adelgatan-north", "norra-adel", "adelgatan", [[337, 145]]),
    makeEdge("adelgatan-south", "adelgatan", "kyrko-adel", [[336, 195]]),

    // Real-street alternates between the original approaches.
    makeEdge("skomakaregatan", "lilla-torg-south", "soder-baltzar", [[210, 377], [250, 386]]),
    makeEdge("stora-nygatan-link", "stora-ny-engelbrekt", "soder-stora-ny", [[205, 507], [247, 490]]),
    makeEdge("kalendegatan", "kalende-kyrko", "baltzar-kalende", [[368, 275], [367, 330]]),
    makeEdge("norra-vallgatan-central", "norra-vaster", "norra-adel", [[258, 134], [296, 125]]),
    makeEdge("norra-vallgatan-east", "norra-adel", "norra-djakne", [[380, 113], [420, 107]]),
    makeEdge("djaknegatan-north", "norra-djakne", "djakne-adel", [[441, 145]]),
    makeEdge("adelgatan-link", "adelgatan", "djakne-adel", [[374, 173], [407, 181]]),

    // Stortorget's perimeter supplements the four pedestrian diagonals.
    makeEdge("square-north", "square-nw", "square-ne", [[244, 223]]),
    makeEdge("square-east", "square-ne", "square-se", [[291, 264]]),
    makeEdge("square-south", "square-se", "square-sw", [[246, 312]]),
    makeEdge("square-west", "square-sw", "square-nw", [[196, 270]]),
  ].map((edge, index) => ({ ...edge, index }));

  const NODE_IDS = Object.keys(NODES);
  const NODE_INDEX = Object.fromEntries(NODE_IDS.map((id, index) => [id, index]));
  const STATUE_INDEX = NODE_INDEX.statue;
  const ADJACENCY = NODE_IDS.map(() => []);
  for (const edge of EDGES) {
    ADJACENCY[NODE_INDEX[edge.from]].push({ edge, to: NODE_INDEX[edge.to] });
    ADJACENCY[NODE_INDEX[edge.to]].push({ edge, to: NODE_INDEX[edge.from] });
  }
  const GEOMETRIC_WEIGHTS = EDGES.map((edge) => edge.length);
  const RNG_SEQUENCES = new WeakMap();

  function createRng(seed) {
    const text = String(seed);
    let state = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      state ^= text.charCodeAt(index);
      state = Math.imul(state, 16777619);
    }
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Dijkstra over the small graph. Positive weights and permanent visited
  // nodes make every returned path simple, including with randomized weights.
  function findPath(entryId, weights) {
    const start = NODE_INDEX[entryId];
    const distances = NODE_IDS.map(() => Infinity);
    const visited = NODE_IDS.map(() => false);
    const previousNodes = NODE_IDS.map(() => -1);
    const previousEdges = NODE_IDS.map(() => -1);
    distances[start] = 0;

    for (let iteration = 0; iteration < NODE_IDS.length; iteration += 1) {
      let current = -1;
      let best = Infinity;
      for (let index = 0; index < NODE_IDS.length; index += 1) {
        if (!visited[index] && distances[index] < best) {
          current = index;
          best = distances[index];
        }
      }
      if (current === -1) break;
      if (current === STATUE_INDEX) break;
      visited[current] = true;
      for (const item of ADJACENCY[current]) {
        if (visited[item.to]) continue;
        const candidate = distances[current] + weights[item.edge.index];
        if (candidate < distances[item.to]) {
          distances[item.to] = candidate;
          previousNodes[item.to] = current;
          previousEdges[item.to] = item.edge.index;
        }
      }
    }

    if (!Number.isFinite(distances[STATUE_INDEX])) {
      throw new Error(`No route from ${entryId} to the statue`);
    }
    const steps = [];
    const pathNodes = [STATUE_INDEX];
    let current = STATUE_INDEX;
    while (current !== start) {
      const previous = previousNodes[current];
      const edge = EDGES[previousEdges[current]];
      steps.push({ from: previous, to: current, edge });
      current = previous;
      pathNodes.push(current);
    }
    steps.reverse();
    pathNodes.reverse();
    return {
      steps,
      nodes: pathNodes,
      length: steps.reduce((sum, step) => sum + step.edge.length, 0),
    };
  }

  function pathPoints(path) {
    const points = [];
    for (const step of path.steps) {
      const forward = NODE_INDEX[step.edge.from] === step.from;
      const edgePoints = forward ? step.edge.points : [...step.edge.points].reverse();
      for (let index = points.length ? 1 : 0; index < edgePoints.length; index += 1) {
        const point = edgePoints[index];
        points.push({ x: point.x, y: point.y });
      }
    }
    return points;
  }

  function prepareRoute(id, entryId, path, randomized, baseLength, sequence) {
    const points = pathPoints(path);
    const segments = [];
    let length = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
      segments.push({ from, to, start: length, length: segmentLength });
      length += segmentLength;
    }
    const info = ENTRY_INFO[entryId];
    return {
      id,
      name: sequence ? `${info.name} · ${sequence}` : info.name,
      color: info.color,
      points,
      segments,
      length,
      baseLength,
      randomized,
      entryId,
    };
  }

  function getShortestRoute(entryId) {
    if (!ENTRY_IDS.includes(entryId)) {
      throw new RangeError(`Unknown route entry: ${entryId}`);
    }
    const path = findPath(entryId, GEOMETRIC_WEIGHTS);
    return prepareRoute(`${entryId}-shortest`, entryId, path, false, path.length, 0);
  }

  function nextSequence(rng, entryId) {
    let sequences = RNG_SEQUENCES.get(rng);
    if (!sequences) {
      sequences = Object.create(null);
      RNG_SEQUENCES.set(rng, sequences);
    }
    sequences[entryId] = (sequences[entryId] || 0) + 1;
    return sequences[entryId];
  }

  function makeRandomRoute(entryId, rng) {
    if (!ENTRY_IDS.includes(entryId)) {
      throw new RangeError(`Unknown route entry: ${entryId}`);
    }
    if (typeof rng !== "function") {
      throw new TypeError("makeRandomRoute requires an RNG function");
    }

    const sequence = nextSequence(rng, entryId);
    const shortest = findPath(entryId, GEOMETRIC_WEIGHTS);
    const baseLength = shortest.length;
    const maximum = baseLength * 1.65 + 1e-9;
    const valid = [];
    const preferred = [];

    for (let candidate = 0; candidate < 8; candidate += 1) {
      const weights = EDGES.map((edge) => edge.length * (0.45 + rng() * 2.1));
      const path = findPath(entryId, weights);
      if (path.length > maximum) continue;
      const item = { path, candidate };
      valid.push(item);
      const ratio = path.length / baseLength;
      if (ratio >= 1.05 && ratio <= 1.5) preferred.push(item);
    }

    const pool = preferred.length ? preferred : valid;
    let chosen = { path: shortest, candidate: "base" };
    if (pool.length) {
      const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
      chosen = pool[index];
    }
    const id = `${entryId}-r${sequence}-c${chosen.candidate}`;
    return prepareRoute(id, entryId, chosen.path, true, baseLength, sequence);
  }

  function getGraphEdges() {
    return EDGES.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      points: edge.points.map((point) => ({ x: point.x, y: point.y })),
      length: edge.length,
    }));
  }

  return {
    STATUE,
    ENTRY_IDS,
    createRng,
    makeRandomRoute,
    getShortestRoute,
    getGraphEdges,
  };
});
