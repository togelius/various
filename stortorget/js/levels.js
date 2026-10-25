(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = data;
  } else {
    root.StortorgetLevels = data;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAP = {
    width: 503,
    height: 594,
    bounds: { north: 55.6094, west: 12.995, south: 55.6022, east: 13.0058 },
    zoom: 16,
  };

  const STATUE = { x: 244.4, y: 269.5 };

  // Routes are hand-traced over the bundled OpenStreetMap image. Units are
  // native image pixels (roughly 1.35 metres), not a separate invented grid.
  const ROUTES = [
    {
      id: "sodergatan",
      name: "Södergatan",
      color: "#ffd166",
      points: [
        [289, 594], [288, 558], [288, 521], [290, 477], [290, 435],
        [291, 391], [291, 349], [291, 307], [277, 292], [244.4, 269.5],
      ],
    },
    {
      id: "baltzarsgatan",
      name: "Baltzarsgatan",
      color: "#ff9f7a",
      points: [
        [503, 390], [461, 390], [414, 390], [366, 390], [329, 390],
        [291, 391], [291, 349], [291, 307], [277, 292], [244.4, 269.5],
      ],
    },
    {
      id: "lillatorg",
      name: "Lilla Torg",
      color: "#c7a0ff",
      points: [
        [0, 548], [66, 545], [119, 535], [169, 520], [165, 485],
        [158, 445], [165, 405], [177, 371], [179, 346], [188, 330],
        [198, 311], [215, 293], [244.4, 269.5],
      ],
    },
    {
      id: "norravallgatan",
      name: "Norra Vallgatan",
      color: "#7dd6c2",
      points: [
        [0, 228], [60, 202], [110, 180], [170, 155], [217, 140],
        [213, 160], [205, 185], [198, 208], [198, 226], [214, 240],
        [244.4, 269.5],
      ],
    },
    {
      id: "djaknegatan",
      name: "Djäknegatan",
      color: "#ff8fab",
      points: [
        [503, 190], [441, 190], [441, 224], [441, 249], [415, 245],
        [385, 232], [351, 225], [334, 222], [292, 222], [280, 235],
        [244.4, 269.5],
      ],
    },
    {
      id: "centralen",
      name: "Malmö Central",
      color: "#82baff",
      points: [
        [331, 61], [331, 91], [333, 119], [337, 145], [338, 170],
        [336, 195], [334, 222], [292, 222], [280, 235], [244.4, 269.5],
      ],
    },
  ];

  // Fixed pavement/plaza sites keep placement legible on a small touchscreen
  // and prevent towers from accidentally blocking or hiding the real streets.
  const BUILD_PADS = [
    { id: "sq-nw", x: 211, y: 235 },
    { id: "sq-ne", x: 276, y: 235 },
    { id: "sq-se", x: 277, y: 288 },
    { id: "sq-sw", x: 212, y: 288 },

    { id: "soder-north", x: 284, y: 330 },
    { id: "soder-mid", x: 298, y: 367 },
    { id: "soder-south", x: 284, y: 438 },

    { id: "baltzar-west", x: 315, y: 384 },
    { id: "baltzar-mid", x: 365, y: 397 },
    { id: "baltzar-east", x: 429, y: 384 },

    { id: "lilla-torg", x: 177, y: 344 },
    { id: "engelbrekt", x: 153, y: 432 },
    { id: "stora-nygatan", x: 158, y: 503 },

    { id: "frans-suell", x: 193, y: 211 },
    { id: "vaster-north", x: 212, y: 183 },
    { id: "vallgatan", x: 223, y: 151 },

    { id: "kyrkogatan", x: 313, y: 217 },
    { id: "adelgatan", x: 344, y: 194 },
    { id: "petribron", x: 326, y: 136 },

    { id: "sjalbodgatan", x: 381, y: 225 },
    { id: "djakne-south", x: 427, y: 256 },
    { id: "djakne-north", x: 449, y: 218 },

    { id: "soder-far", x: 284, y: 466 },
    { id: "gustav-adolf", x: 271, y: 535 },
  ];

  const TOWER_TYPES = {
    falafel: {
      id: "falafel",
      name: "Falafel stand",
      shortName: "Falafel",
      icon: "●●●",
      color: "#2fbea0",
      cost: 60,
      description: "Quick single-target shots",
      range: 69,
      levels: [
        { damage: 13, rate: 0.62, range: 69, projectileSpeed: 270 },
        { damage: 20, rate: 0.54, range: 75, projectileSpeed: 290, upgradeCost: 50 },
        { damage: 30, rate: 0.46, range: 82, projectileSpeed: 315, upgradeCost: 85 },
      ],
    },
    bulle: {
      id: "bulle",
      name: "Cinnamon bun mortar",
      shortName: "Bun mortar",
      icon: "◎",
      color: "#f2a65a",
      cost: 95,
      description: "Heavy hits with splash damage",
      range: 84,
      levels: [
        { damage: 27, rate: 1.62, range: 84, splash: 22, projectileSpeed: 185 },
        { damage: 42, rate: 1.45, range: 91, splash: 26, projectileSpeed: 200, upgradeCost: 75 },
        { damage: 65, rate: 1.28, range: 98, splash: 31, projectileSpeed: 220, upgradeCost: 115 },
      ],
    },
    glass: {
      id: "glass",
      name: "Ice-cream van",
      shortName: "Ice cream",
      icon: "▼",
      color: "#72b7e8",
      cost: 75,
      description: "Slows one attacker at a time",
      range: 65,
      levels: [
        { damage: 6, rate: 0.92, range: 65, slowFactor: 0.58, slowDuration: 1.5, projectileSpeed: 235 },
        { damage: 10, rate: 0.82, range: 72, slowFactor: 0.46, slowDuration: 1.9, projectileSpeed: 250, upgradeCost: 60 },
        { damage: 16, rate: 0.72, range: 79, slowFactor: 0.36, slowDuration: 2.3, projectileSpeed: 270, upgradeCost: 95 },
      ],
    },
  };

  const ENEMY_TYPES = {
    basic: {
      id: "basic",
      name: "Dans kjävel",
      hp: 34,
      speed: 18,
      bounty: 11,
      leak: 1,
      size: 8,
    },
    runner: {
      id: "runner",
      name: "Snabb dans kjävel",
      hp: 25,
      speed: 29,
      bounty: 12,
      leak: 1,
      size: 7,
    },
    tank: {
      id: "tank",
      name: "Stursk dans kjävel",
      hp: 125,
      speed: 11.5,
      bounty: 26,
      leak: 2,
      size: 11,
    },
    boss: {
      id: "boss",
      name: "Store dans kjäveln",
      hp: 950,
      speed: 8.5,
      bounty: 200,
      leak: 8,
      size: 16,
    },
  };

  const WAVES = [
    {
      name: "The first arrivals",
      hpScale: 1,
      routes: ["sodergatan"],
      groups: [
        { route: "sodergatan", type: "basic", count: 8, every: 1.45, at: 0 },
      ],
    },
    {
      name: "A pincer movement",
      hpScale: 1.1,
      routes: ["sodergatan", "baltzarsgatan"],
      groups: [
        { route: "sodergatan", type: "basic", count: 7, every: 1.5, at: 0 },
        { route: "baltzarsgatan", type: "basic", count: 7, every: 1.5, at: 2.2 },
      ],
    },
    {
      name: "Trouble at Lilla Torg",
      hpScale: 1.25,
      routes: ["lillatorg", "norravallgatan"],
      groups: [
        { route: "lillatorg", type: "basic", count: 9, every: 1.35, at: 0 },
        { route: "norravallgatan", type: "basic", count: 7, every: 1.45, at: 1 },
        { route: "lillatorg", type: "runner", count: 4, every: 1.7, at: 8 },
      ],
    },
    {
      name: "The eastern front",
      hpScale: 1.45,
      routes: ["djaknegatan", "baltzarsgatan", "sodergatan"],
      groups: [
        { route: "djaknegatan", type: "basic", count: 10, every: 1.25, at: 0 },
        { route: "baltzarsgatan", type: "runner", count: 6, every: 1.6, at: 4 },
        { route: "sodergatan", type: "tank", count: 2, every: 5, at: 7 },
        { route: "sodergatan", type: "basic", count: 6, every: 1.3, at: 2 },
      ],
    },
    {
      name: "They came by train",
      hpScale: 1.7,
      routes: ["centralen", "norravallgatan", "lillatorg"],
      groups: [
        { route: "centralen", type: "basic", count: 10, every: 1.2, at: 0 },
        { route: "centralen", type: "tank", count: 3, every: 4, at: 6 },
        { route: "norravallgatan", type: "runner", count: 8, every: 1.35, at: 2 },
        { route: "lillatorg", type: "basic", count: 9, every: 1.25, at: 4 },
      ],
    },
    {
      name: "Rush hour",
      hpScale: 2,
      routes: ["sodergatan", "baltzarsgatan", "lillatorg", "djaknegatan"],
      groups: [
        { route: "sodergatan", type: "basic", count: 10, every: 1.15, at: 0 },
        { route: "baltzarsgatan", type: "basic", count: 9, every: 1.2, at: 1.5 },
        { route: "lillatorg", type: "runner", count: 9, every: 1.35, at: 4 },
        { route: "djaknegatan", type: "tank", count: 5, every: 3.5, at: 3 },
      ],
    },
    {
      name: "All roads to Stortorget",
      hpScale: 2.35,
      routes: ["centralen", "norravallgatan", "djaknegatan", "baltzarsgatan", "sodergatan", "lillatorg"],
      groups: [
        { route: "centralen", type: "basic", count: 8, every: 1.25, at: 0 },
        { route: "norravallgatan", type: "runner", count: 8, every: 1.3, at: 2 },
        { route: "djaknegatan", type: "basic", count: 8, every: 1.2, at: 1 },
        { route: "baltzarsgatan", type: "tank", count: 4, every: 3.4, at: 5 },
        { route: "sodergatan", type: "basic", count: 8, every: 1.15, at: 3 },
        { route: "lillatorg", type: "runner", count: 8, every: 1.25, at: 6 },
        { route: "centralen", type: "tank", count: 3, every: 4, at: 10 },
      ],
    },
    {
      name: "The last Dane standing",
      hpScale: 2.7,
      routes: ["centralen", "norravallgatan", "djaknegatan", "baltzarsgatan", "sodergatan", "lillatorg"],
      groups: [
        { route: "centralen", type: "boss", count: 1, every: 1, at: 24 },
        { route: "centralen", type: "basic", count: 8, every: 1.2, at: 0 },
        { route: "norravallgatan", type: "runner", count: 8, every: 1.3, at: 2 },
        { route: "djaknegatan", type: "tank", count: 3, every: 4.2, at: 5 },
        { route: "baltzarsgatan", type: "basic", count: 8, every: 1.15, at: 1 },
        { route: "sodergatan", type: "basic", count: 8, every: 1.15, at: 3 },
        { route: "lillatorg", type: "runner", count: 8, every: 1.25, at: 6 },
        { route: "sodergatan", type: "tank", count: 2, every: 5, at: 12 },
      ],
    },
  ];

  const CONFIG = {
    startingMoney: 240,
    startingHealth: 20,
    maxHealth: 20,
    intermissionSeconds: 20,
    sellRefund: 0.7,
    fikaDuration: 5,
    fikaCooldown: 38,
    fikaSlowFactor: 0.48,
  };

  function prepareRoute(route) {
    const points = route.points.map(([x, y]) => ({ x, y }));
    const segments = [];
    let length = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
      segments.push({ from, to, start: length, length: segmentLength });
      length += segmentLength;
    }
    return { ...route, points, segments, length };
  }

  const PREPARED_ROUTES = ROUTES.map(prepareRoute);

  function pointOnRoute(route, distance) {
    const clamped = Math.max(0, Math.min(route.length, distance));
    const segment = route.segments.find((item) => clamped <= item.start + item.length)
      || route.segments[route.segments.length - 1];
    const progress = segment.length === 0 ? 0 : (clamped - segment.start) / segment.length;
    return {
      x: segment.from.x + (segment.to.x - segment.from.x) * progress,
      y: segment.from.y + (segment.to.y - segment.from.y) * progress,
      angle: Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x),
    };
  }

  return {
    MAP,
    STATUE,
    ROUTES: PREPARED_ROUTES,
    BUILD_PADS,
    TOWER_TYPES,
    ENEMY_TYPES,
    WAVES,
    CONFIG,
    pointOnRoute,
  };
});
