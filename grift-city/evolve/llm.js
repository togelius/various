// LLM backends for the variation operator (mutation, crossover, repair). ask(prompt) -> { text, model }.
//   claude-cli : `claude -p` with the login Claude Code already has (default; no API key needed)
//   anthropic  : Messages API over fetch (needs ANTHROPIC_API_KEY)
//   queue      : writes <dir>/<id>.prompt.md and waits for <dir>/<id>.response.md, so any other agent (a Claude Code
//                session with subagents, say) can play the LLM
//   mock       : no LLM at all; perturbs the numbers in the parent. For tests and for exercising the loop offline.
// `models` is an ensemble [{name, weight}]: a fast model for breadth and a stronger one for depth, picked by weight.
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

function claudeCli(model, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn('claude', ['-p', '--model', model, '--output-format', 'text', '--tools', ''], { cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('llm timeout')); }, timeoutMs);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', c => { clearTimeout(timer); c === 0 && out.trim() ? resolve(out) : reject(new Error('claude exited ' + c + ': ' + (err || out).slice(0, 200))); });
    p.stdin.end(prompt);
  });
}
async function anthropicApi(model, prompt, timeoutMs) {
  const base = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const r = await fetch(base + '/v1/messages', { method: 'POST', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }) });
  if (!r.ok) throw new Error('api ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json(); return j.content.map(c => c.text || '').join('');
}
let queueN = 0;
async function queue(dir, prompt, timeoutMs) {
  fs.mkdirSync(dir, { recursive: true }); const id = String(Date.now()) + '-' + (queueN++);
  fs.writeFileSync(path.join(dir, id + '.prompt.md'), prompt);
  const resp = path.join(dir, id + '.response.md'), t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (fs.existsSync(resp)) { await new Promise(r => setTimeout(r, 200)); return fs.readFileSync(resp, 'utf8'); } await new Promise(r => setTimeout(r, 1000)); }
  throw new Error('queue timeout');
}
// perturbs the numbers in the PARENT block (or the first parent) and flips an occasional comparison
async function mock(prompt) {
  if (/We keep a shared HELPER LIBRARY/.test(prompt)) { const n = 'mockHelper' + Math.floor(Math.random() * 1e6); return '```js\n// clamp to -1..1\nfunction ' + n + '(v) { return Math.max(-1, Math.min(1, v)); }\n```'; }
  const m = prompt.match(/PARENT[^\n]*\n```js\n([\s\S]*?)```/); if (!m) throw new Error('mock: no parent');
  let code = m[1], n = 0;
  code = code.replace(/(?<![\w.])(\d+\.?\d*)(?![\w.])/g, (s, v) => { if (+v > 3 && Math.random() < 0.15) { n++; return String(+(v * (0.7 + Math.random() * 0.6)).toFixed(2)); } if (+v <= 3 && Math.random() < 0.1) { n++; return String(+(v * (0.6 + Math.random() * 0.8)).toFixed(2)); } return s; });
  if (!n) code = code.replace(/\b2\.2\b/, '1.9');
  return 'Perturbed a few constants.\n```js\n' + code + '```';
}

function makeLLM({ backend = 'claude-cli', models = [{ name: 'haiku', weight: 1 }], timeoutMs = 300000, queueDir = path.join(os.tmpdir(), 'grift-evolve-queue') } = {}) {
  const total = models.reduce((s, m) => s + m.weight, 0);
  return {
    backend, models,
    async ask(prompt) {
      let r = Math.random() * total, mod = models[0]; for (const m of models) { if ((r -= m.weight) < 0) { mod = m; break; } }
      const text = backend === 'mock' ? await mock(prompt) : backend === 'anthropic' ? await anthropicApi(mod.name, prompt, timeoutMs) : backend === 'queue' ? await queue(queueDir, prompt, timeoutMs) : await claudeCli(mod.name, prompt, timeoutMs);
      return { text, model: backend === 'queue' ? 'queue' : mod.name };
    },
  };
}
const parseModels = s => s.split(',').map(x => { const [name, w] = x.split(':'); return { name, weight: w === undefined ? 1 : +w }; });
module.exports = { makeLLM, parseModels };
