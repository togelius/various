"use strict";
// SQUARE OFF: bundle index.html + every <script defer> + both stylesheets into one self-contained
// file, dist/square-off.html, that runs from file:// (double-click) or any static host.
// No dependencies. Script order is preserved; scripts run at the end of <body>, i.e. after the
// DOM exists, exactly like the deferred originals. Google Fonts stay an optional @import
// (offline the HUD falls back to system fonts).
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || path.join(root, "dist", "square-off.html"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

let html = read("index.html");

const scripts = [];
html = html.replace(/[ \t]*<script defer src="([^"]+)"><\/script>\n?/g, (_, file) => {
  const source = read(file);
  // Prevent strings inside a script from closing its <script> element early.
  scripts.push(`<script>/* ${file} */\n${source.replace(/<\/script/gi, "<\\/script")}\n</script>`);
  return "";
});
if (scripts.length < 10) throw new Error(`Only ${scripts.length} scripts found: index.html changed?`);

let styles = 0;
html = html.replace(/[ \t]*<link rel="stylesheet" href="([^"]+)">\n?/g, (_, file) => {
  styles++;
  return `<style>/* ${file} */\n${read(file).replace(/<\/style/gi, "<\\/style")}\n</style>\n`;
});
if (styles < 2) throw new Error("Stylesheets not found: index.html changed?");

// Comment markers left behind by the removed script tags are harmless; drop the empty ones.
html = html.replace(/[ \t]*<!--[^>]*-->\n(?=\s*(<!--|<\/head>))/g, "");
html = html.replace("</body>", () => `${scripts.join("\n")}\n</body>`);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(`Built ${path.relative(process.cwd(), output) || output} (${(Buffer.byteLength(html) / 1048576).toFixed(2)} MiB, ${scripts.length} scripts, ${styles} stylesheets)`);
