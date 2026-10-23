// ACCESSION — screenshots for review: node tools/browser/shoot.mjs [query] [name] [w] [h]
import { open, root } from './lib.mjs';
import path from 'node:path';
const [query = '', name = 'shot', w = '390', h = '844'] = process.argv.slice(2);
const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: +w, height: +h }, dpr: 2, query: query ? '?' + query : '' });
await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
await page.waitForTimeout(400);
const view = await page.evaluate(async () => { await window.ACCESSION.renderer.ready.catch(() => {}); return window.ACCESSION.views.active(); });
await page.screenshot({ path: path.join(root, 'test/shots', name + '.png') });
await browser.close();
console.log(`${name}: view ${view.id}${view.note ? ' (' + view.note + ')' : ''}, errors ${errors.length}${errors.length ? ': ' + errors.join('; ') : ''}`);
