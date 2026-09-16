// Build contact sheets (4x3 thumbnails with captions) from a playtest session. usage: node contact.js <name>
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })(); const fs = require('fs'); const path = require('path');
(async () => { const name = process.argv[2]; const dir = path.join(__dirname, 'pt', name); let shots; try { shots = JSON.parse(fs.readFileSync(path.join(dir, 'shots.json'))); } catch (e) { shots = fs.readdirSync(dir).filter(f => /^\d+\.png$/.test(f)).sort().map(f => ({ file: path.join(dir, f), label: f })); }
  shots = shots.filter(sh => fs.existsSync(sh.file));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 810 } });
  for (let s = 0; s * 12 < shots.length; s++) { const batch = shots.slice(s * 12, s * 12 + 12);
    const html = '<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,320px);grid-auto-rows:270px;font:11px sans-serif;color:#fff">' + batch.map((sh, i) => `<div style="position:relative"><img src="data:image/png;base64,${fs.readFileSync(sh.file).toString('base64')}" style="width:320px;height:180px;display:block"><div style="padding:3px 5px;background:#222;height:84px;overflow:hidden">#${s * 12 + i}  ${(sh.label || '').replace(/</g, '&lt;')}</div></div>`).join('') + '</body>';
    await p.setContent(html); const out = path.join(dir, `sheet${s}.png`); await p.screenshot({ path: out, fullPage: true }); console.log('wrote', out); }
  await b.close(); })();
