"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { Game } = require("../js/engine.js");
const levels = require("../js/levels.js");

test("preview checks whole road segments, including exact range boundaries", () => {
  const route = { id: "long-road", points: [{ x: -100, y: 0 }, { x: 100, y: 0 }],
    segments: [{ from: { x: -100, y: 0 }, to: { x: 100, y: 0 }, length: 200, start: 0 }], length: 200 };
  const range = levels.TOWER_TYPES.falafel.levels[0].range;
  const game = new Game({ levels: { ...levels, ROUTES: [route],
    BUILD_PADS: [{ id: "tangent", x: 0, y: range }, { id: "outside", x: 0, y: range + 0.01 }],
    WAVES: [{ ...levels.WAVES[0], routes: [route.id] }],
  } });
  assert.deepEqual(game.getPlacementPreview("tangent", "falafel").routes, [route.id]);
  assert.deepEqual(game.getPlacementPreview("outside", "falafel").routes, []);
});

test("preview follows current and upcoming approaches, without mutating the game", () => {
  for (const mode of ["american", "skanska"]) {
    const game = new Game({ mode });
    const before = JSON.stringify(game);
    assert.deepEqual(game.getPlacementPreview("soder-south", "falafel").routes, ["sodergatan"]);
    assert.deepEqual(game.getPlacementPreview("petribron", "falafel").routes, []);
    assert.equal(JSON.stringify(game), before);
    game.currentWave = 3;
    game.phase = "intermission";
    const upcoming = game.getPlacementPreview("sq-nw", "bulle");
    assert.ok(upcoming.routes.length > 0);
    assert.ok(upcoming.routes.every((id) => game.getNextWave().routes.includes(id)));
    game.startWave();
    assert.deepEqual(game.getPlacementPreview("sq-nw", "bulle"), upcoming);
  }
});

test("coffee previews count attacking neighbours only; invalid and occupied sites are rejected", () => {
  const game = new Game({ config: { startingMoney: 1000 } });
  assert.equal(game.getPlacementPreview("sq-se", "espresso").allies, 0);
  game.buildTower("soder-north", "falafel");
  game.buildTower("sq-ne", "espresso");
  game.buildTower("gustav-adolf", "falafel");
  const preview = game.getPlacementPreview("sq-se", "espresso");
  assert.equal(preview.support, true);
  assert.equal(preview.allies, 1);
  const built = game.buildTower("sq-se", "espresso").tower;
  assert.equal(preview.range, game.getTowerStats(built).range);
  assert.equal(game.getPlacementPreview("sq-se", "falafel"), null);
  assert.equal(game.getPlacementPreview("missing", "falafel"), null);
  assert.equal(game.getPlacementPreview("sq-sw", "missing"), null);
});
