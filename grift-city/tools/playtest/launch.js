// One browser launcher for every playtest tool. Uses Playwright's bundled Chromium when it is installed and
// an installed Google Chrome otherwise (set PW_CHANNEL to force one), so the suites run on a developer's
// machine without a separate browser download. PW_GPU=1 asks for the real GPU instead of SwiftShader.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const SOFTWARE = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const HARDWARE = ['--enable-gpu', '--ignore-gpu-blocklist'];
async function launch(extraArgs = []) {
  const args = (process.env.PW_GPU ? HARDWARE : SOFTWARE).concat(['--mute-audio'], extraArgs);
  const channel = process.env.PW_CHANNEL;
  if (channel) return chromium.launch({ channel, args });
  try { return await chromium.launch({ args }); }
  catch (e) { return chromium.launch({ channel: 'chrome', args }); } // no bundled browser: fall back to installed Chrome
}
module.exports = { chromium, launch };
