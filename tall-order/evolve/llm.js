// LLM backends for the mutation / crossover / repair operator.
//   claude-cli : `claude -p` (uses whatever login Claude Code has; the default)
//   anthropic  : Messages API over fetch (needs ANTHROPIC_API_KEY)
//   mock       : no LLM; perturbs numeric constants. For smoke-testing the loop offline only.
const { spawn } = require('child_process');
const os = require('os');

function claudeCli(model, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn('claude', ['-p', '--model', model, '--output-format', 'text', '--tools', ''], { cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('llm timeout')); }, timeoutMs);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
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
// perturbs the numbers in the first ```js block of the parent it finds in the prompt
async function mock(model, prompt) {
  const m = prompt.match(/PARENT[^\n]*\n```js\n([\s\S]*?)```/); if (!m) throw new Error('mock: no parent');
  let code = m[1];
  code = code.replace(/(?<![\w.])(\d+\.?\d*)(?![\w])/g, (s, v) => Math.random() < 0.25 ? String(+(v * (0.6 + Math.random() * 0.8)).toFixed(2)) : s);
  if (Math.random() < 0.3) code = code.replace(/fire:\s*[^,}]+/, 'fire: !!o.aim.hit || o.foes.length > 0 && o.foes[0].band');
  return '```js\n' + code + '```';
}

// models: [{name, weight, backend}]; picks one by weight (an ensemble: a fast model for breadth, a stronger one for depth)
function makeLLM({ backend = 'claude-cli', models = [{ name: 'haiku', weight: 1 }], timeoutMs = 300000 } = {}) {
  const total = models.reduce((s, m) => s + m.weight, 0);
  return {
    backend,
    async ask(prompt) {
      let r = Math.random() * total, mod = models[0]; for (const m of models) { if ((r -= m.weight) < 0) { mod = m; break; } }
      const f = backend === 'mock' ? mock : backend === 'anthropic' ? anthropicApi : claudeCli;
      const text = await f(mod.name, prompt, timeoutMs);
      return { text, model: mod.name };
    },
  };
}
module.exports = { makeLLM };
