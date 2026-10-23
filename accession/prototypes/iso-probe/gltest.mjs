import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const variants = [
  { name: 'default', args: [] },
  { name: 'angle-swiftshader', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  { name: 'gl-swiftshader', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
  { name: 'angle-swiftshader-webgl', args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] },
];
for (const v of variants) {
  for (const headless of [true]) {
    let browser;
    try {
      browser = await chromium.launch({ headless, args: v.args });
      const page = await browser.newPage();
      const r = await page.evaluate(() => {
        const c = document.createElement('canvas');
        const out = {};
        for (const t of ['webgl2', 'webgl']) {
          const gl = c.getContext(t);
          if (!gl) { out[t] = null; continue; }
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          out[t] = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
          break;
        }
        return out;
      });
      console.log(v.name, 'headless=' + headless, JSON.stringify(r), browser.version());
    } catch (e) { console.log(v.name, 'ERR', e.message.split('\n')[0]); }
    finally { if (browser) await browser.close(); }
  }
}
