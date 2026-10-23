// Does a save survive the whole browser being killed? Writes one value to localStorage and to
// IndexedDB, waits DELAY ms, SIGKILLs Chromium (persistent profile), relaunches and reads both back.
// Usage: node savekill.cjs [trials-per-delay]   (needs Playwright with Chromium; Linux, uses pkill)
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { execSync } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGE = `<!doctype html><meta charset="utf-8"><script>
function idb(){return new Promise((ok,no)=>{const r=indexedDB.open('save',1);r.onupgradeneeded=()=>r.result.createObjectStore('s');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
async function read(){const db=await idb();return new Promise(ok=>{const g=db.transaction('s').objectStore('s').get('slot');g.onsuccess=()=>ok(g.result||'none');g.onerror=()=>ok('err');});}
window.save=async function(tag){localStorage.setItem('slot',tag);const db=await idb();
  await new Promise((ok,no)=>{const t=db.transaction('s','readwrite');t.objectStore('s').put(tag,'slot');t.oncomplete=ok;t.onerror=()=>no(t.error);});
  console.log('SAVED');};
read().then(v=>console.log('LOADED ls='+(localStorage.getItem('slot')||'none')+' idb='+v));
</script>`;
async function open(dir, url) {
  const ctx = await pw.chromium.launchPersistentContext(dir, { args: ['--mute-audio'] });
  const p = ctx.pages()[0] || await ctx.newPage(); const lines = [];
  p.on('console', m => lines.push(m.text()));
  await p.goto(url);
  for (let t = 0; t < 3000 && !lines.some(l => l.startsWith('LOADED')); t += 5) await sleep(5);
  return { ctx, p, lines };
}
(async () => {
  const trials = +(process.argv[2] || 3);
  const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'savekill-'));
  const tally = {};
  for (const delay of [0, 50, 250, 1000, 2000, 4000, 8000]) {
    for (let i = 0; i < trials; i++) {
      const dir = fs.mkdtempSync(path.join(root, 'u-')); const tag = 't' + delay + '_' + i;
      const a = await open(dir, url);
      await a.p.evaluate(t => window.save(t), tag);
      await sleep(delay);
      try { execSync(`pkill -9 -f -- '${dir}'`); } catch (e) {}
      await sleep(300); a.ctx.close().catch(() => {});
      const b = await open(dir, url); const line = b.lines.find(l => l.startsWith('LOADED')) || 'LOADED ?';
      await b.ctx.close();
      const k = delay + ' ms'; tally[k] = tally[k] || { localStorage: 0, IndexedDB: 0, n: 0 };
      tally[k].n++; if (line.includes('ls=' + tag)) tally[k].localStorage++; if (line.includes('idb=' + tag)) tally[k].IndexedDB++;
    }
  }
  server.close(); fs.rmSync(root, { recursive: true, force: true });
  console.log('kill after save | localStorage survived | IndexedDB survived');
  for (const [k, v] of Object.entries(tally)) console.log(`${k} | ${v.localStorage}/${v.n} | ${v.IndexedDB}/${v.n}`);
})();
