"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

test("portable build embeds the map and ordered, parseable scripts after the page", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "stortorget-bundle-"));
  try {
    const output = path.join(folder, "Stortorget.html");
    execFileSync(process.execPath, [path.join(__dirname, "../tools/build-standalone.js"), output]);
    const html = fs.readFileSync(output, "utf8");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 7);
    for (const [index, script] of scripts.entries()) new vm.Script(script[1], { filename: `bundle-${index}.js` });
    assert.ok(html.indexOf('<canvas id="game-canvas"') < scripts[0].index);
    assert.match(html, /image.src = "data:image\/png;base64,/);
    assert.match(html, /href="data:image\/svg\+xml;base64,/);
    assert.doesNotMatch(html, /(?:src|href)="(?:js|css|assets)\//);
    assert.ok(html.includes('.clear-card {'));
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
