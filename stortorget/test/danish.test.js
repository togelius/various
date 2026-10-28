"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const levels = require("../js/levels.js");
const DANISH = require("../js/danish.js");

function pools() {
  return [
    ...Object.entries(DANISH.CHATTER).map(([key, lines]) => [`chatter.${key}`, lines]),
    ...Object.entries(DANISH.EVENTS).map(([key, lines]) => [`events.${key}`, lines]),
    ...Object.entries(DANISH.MODE).map(([key, lines]) => [`mode.${key}`, lines]),
    ...Object.entries(DANISH.ROUTES).map(([key, lines]) => [`routes.${key}`, lines]),
  ];
}

test("every Danish pool fits speech bubbles and never repeats a line", () => {
  for (const [name, lines] of pools()) {
    assert.ok(lines.length >= 2, `${name} needs some variety`);
    assert.equal(new Set(lines).size, lines.length, `${name} has duplicate lines`);
    for (const line of lines) assert.ok(line.length <= 36, `Speech bubble is too long: ${line}`);
  }
});

test("Danish pools add to the stock quips instead of repeating them", () => {
  for (const [type, definition] of Object.entries(levels.ENEMY_TYPES)) {
    const extra = DANISH.CHATTER[type];
    assert.ok(extra && extra.length >= 12, `${type} should get a deep extra pool`);
    for (const line of extra) assert.ok(!definition.quips.includes(line), `${type} repeats a stock quip: ${line}`);
  }
  for (const [event, lines] of Object.entries(levels.QUIPS)) {
    for (const line of DANISH.EVENTS[event] || []) assert.ok(!lines.includes(line), `${event} repeats a stock quip: ${line}`);
  }
  for (const event of ["slow", "fireworks", "gust", "home", "splash", "bossIntro"]) {
    assert.ok(DANISH.EVENTS[event].length >= 4, `${event} needs its own lines`);
  }
});

test("every street has something to say and both editions get answered", () => {
  for (const route of levels.ROUTES) assert.ok(DANISH.ROUTES[route.id], `${route.id} has no arrival lines`);
  for (const mode of Object.keys(levels.MODES)) assert.ok(DANISH.MODE[mode].length >= 4, `${mode} has no replies`);
});

test("the rivalry references are all there", () => {
  const everything = pools().flatMap(([, lines]) => lines).join(" | ");
  for (const reference of [
    "Saga", "Martin Rohde", "grænsen", // Bron/Broen
    "Riget", "Helmer", // Riget
    "'92", "Schmeichel", // EM 1992 in Sweden
    "Jeg har en plan", "Egon", // Olsen-banden
    "Systembolaget", "Lagom", "IKEA", "kroner", "kø", // poking at Swedes
    "1658", "1676", "Kalmarunionen", "Tycho Brahe", // history
    "sgu", "Pyt", "Hold da op", "hygge", // real Danish
  ]) {
    assert.ok(everything.includes(reference), `Missing reference: ${reference}`);
  }
});
