/* Tile PNGs into one contact sheet, for looking at a sequence at once.
 * usage: node tools/contact.js <out.png> <cols> <scale> [crop=x,y,w,h] <files...>
 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  let [out, colsA, scaleA, ...files] = process.argv.slice(2);
  let crop = null;
  if (files[0] && files[0].startsWith('crop=')) { crop = files.shift().slice(5).split(',').map(Number); }
  const cols = parseInt(colsA, 10), scale = parseFloat(scaleA);
  const urls = files.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  const b = await chromium.launch(); const page = await b.newPage();
  const data = await page.evaluate(async ({ urls, cols, scale, crop }) => {
    const imgs = await Promise.all(urls.map(u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; })));
    const cr = crop || [0, 0, imgs[0].width, imgs[0].height];
    const w = cr[2] * scale, h = cr[3] * scale, rows = Math.ceil(imgs.length / cols);
    const c = document.createElement('canvas'); c.width = cols * w + (cols - 1) * 4; c.height = rows * h + (rows - 1) * 4;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#ff00ff'; x.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, k) => x.drawImage(im, cr[0], cr[1], cr[2], cr[3], (k % cols) * (w + 4), Math.floor(k / cols) * (h + 4), w, h));
    return c.toDataURL('image/png');
  }, { urls, cols, scale, crop });
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  await b.close(); console.log('ok ->', out);
})();
