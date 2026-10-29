"use strict";

// No dependencies: preserve script order, but execute only after the DOM exists.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || path.join(root, "dist", "Stortorget.html"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(path.join(root, file)).toString("base64")}`;
let html = read("index.html");
const scripts = [];
html = html.replace(/<script defer src="([^"]+)"><\/script>/g, (_, file) => {
  let source = read(file);
  if (file === "js/ui.js") {
    const assignment = 'image.src = "assets/malmo-map.png";';
    if (!source.includes(assignment)) throw new Error("Map loader changed: update standalone embedding");
    source = source.replace(assignment, `image.src = ${JSON.stringify(dataUri("assets/malmo-map.png", "image/png"))};`);
  }
  // Prevent strings in a script from prematurely closing its HTML element.
  scripts.push(`<script>\n${source.replace(/<\/script/gi, "<\\/script")}\n</script>`);
  return "";
});
if (!scripts.length) throw new Error("No game scripts found");
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${read("css/style.css")}\n</style>`);
html = html.replace('href="assets/favicon.svg"', () => `href="${dataUri("assets/favicon.svg", "image/svg+xml")}"`);
html = html.replace("</body>", () => `${scripts.join("\n")}\n</body>`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(`Built ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KiB)`);
