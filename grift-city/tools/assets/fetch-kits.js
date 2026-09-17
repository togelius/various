// Download Kenney asset kits (kenney.nl, CC0) into a local cache.
// The download link is only in the rendered page, so this drives a browser to find it.
// usage: node tools/assets/fetch-kits.js <cache-dir> <slug> [slug ...]
// e.g.   node tools/assets/fetch-kits.js /tmp/kits nature-kit car-kit city-kit-commercial
const { launch } = require('../playtest/launch.js');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

(async () => {
  const cache = process.argv[2], slugs = process.argv.slice(3);
  if (!cache || !slugs.length) { console.error('usage: fetch-kits.js <cache-dir> <slug> [slug ...]'); process.exit(1); }
  fs.mkdirSync(cache, { recursive: true });
  const b = await launch(); const p = await b.newPage();
  for (const slug of slugs) {
    const dir = path.join(cache, slug.replace(/^github:.*\//, ''));
    if (fs.existsSync(dir) && fs.readdirSync(dir).length) { console.log(slug.padEnd(26), 'cached'); continue; }
    try {
      if (slug.startsWith('github:')) { // a starter kit lives in a repo rather than behind a download page
        const repo = slug.slice(7);
        execFileSync('git', ['clone', '-q', '--depth', '1', 'https://github.com/' + repo + '.git', dir]);
        const n = execFileSync('sh', ['-c', `find ${JSON.stringify(dir)} -iname '*.glb' | wc -l`]).toString().trim();
        console.log(slug.padEnd(26), 'cloned,', n, 'models'); continue;
      }
      await p.goto('https://kenney.nl/assets/' + slug, { waitUntil: 'networkidle', timeout: 90000 });
      const url = await p.evaluate(() => (Array.from(document.querySelectorAll('a')).map(a => a.href).find(h => /\.zip$/i.test(h)) || ''));
      if (!url) { console.log(slug.padEnd(26), 'no download link found'); continue; }
      const zip = path.join(cache, slug + '.zip');
      execFileSync('curl', ['-sSL', '--max-time', '600', '-o', zip, url]);
      fs.mkdirSync(dir, { recursive: true });
      execFileSync('unzip', ['-qo', zip, '-d', dir]);
      fs.unlinkSync(zip);
      const n = execFileSync('sh', ['-c', `find ${JSON.stringify(dir)} -iname '*.glb' -o -iname '*.gltf' -o -iname '*.obj' | wc -l`]).toString().trim();
      console.log(slug.padEnd(26), 'downloaded,', n, 'models');
    } catch (e) { console.log(slug.padEnd(26), 'FAILED', String(e.message).slice(0, 80)); }
  }
  await b.close();
})();
