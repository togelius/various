/* The LLM as variation operator.
 *
 * Calls go through the `claude` CLI in print mode with every tool disabled, no
 * MCP servers, no session saved, a replaced system prompt, and an empty working
 * directory, so the model sees exactly the prompt it is given and can do
 * nothing but answer it.
 *
 * Two output forms, as in AlphaEvolve: a diff of SEARCH/REPLACE blocks for
 * targeted changes, and a whole program for rewrites, crossover and steering.
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The ensemble: a fast model for most proposals, a strong one for some.
const MODELS = { fast: 'claude-haiku-5-5', strong: 'claude-sonnet-5-5' };

const CWD = fs.mkdtempSync(path.join(os.tmpdir(), 'vz-evo-llm-'));

function callLLM({ model, system, prompt, timeoutMs = 300000 }) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const args = ['-p', '--model', model, '--tools', '', '--strict-mcp-config',
      '--no-session-persistence', '--output-format', 'json', '--system-prompt', system];
    const child = spawn('claude', args, { cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => {
      clearTimeout(timer);
      const ms = Date.now() - t0;
      try {
        const j = JSON.parse(out);
        if (j.is_error) return resolve({ ok: false, error: String(j.result || 'error').slice(0, 300), ms, cost: j.total_cost_usd || 0 });
        resolve({ ok: true, text: String(j.result || ''), cost: j.total_cost_usd || 0, ms,
          tokens: j.usage ? (j.usage.input_tokens || 0) + (j.usage.cache_read_input_tokens || 0) +
            (j.usage.cache_creation_input_tokens || 0) + (j.usage.output_tokens || 0) : 0 });
      } catch (e) {
        resolve({ ok: false, error: ('exit ' + code + ': ' + (err || out)).slice(0, 300), ms, cost: 0 });
      }
    });
    child.stdin.end(prompt);
  });
}

// --------------------------------------------------------------- parsing
/* AlphaEvolve's diff format. Each SEARCH must match the current source exactly
 * once; trailing whitespace is forgiven, nothing else is. */
function applyDiff(src, text) {
  const re = /<{7} SEARCH\r?\n([\s\S]*?)\r?\n={7}\r?\n([\s\S]*?)\r?\n?>{7} REPLACE/g;
  const blocks = [];
  let m;
  while ((m = re.exec(text))) blocks.push({ find: m[1], repl: m[2] });
  if (!blocks.length) return { ok: false, why: 'no SEARCH/REPLACE blocks in the answer' };
  let cur = src;
  const rstrip = s => s.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b.find.trim()) return { ok: false, why: 'block ' + (i + 1) + ' has an empty SEARCH' };
    let n = cur.split(b.find).length - 1;
    if (n === 1) { cur = cur.replace(b.find, () => b.repl); continue; }
    const c2 = rstrip(cur), f2 = rstrip(b.find);
    n = c2.split(f2).length - 1;
    if (n === 1) { cur = c2.replace(f2, () => b.repl); continue; }
    return { ok: false, why: 'block ' + (i + 1) + ' SEARCH text ' + (n ? 'matches ' + n + ' places' : 'not found') };
  }
  return { ok: true, src: cur, blocks: blocks.length };
}

function extractProgram(text) {
  const re = /```(?:js|javascript)?[^\n]*\n([\s\S]*?)```/g;
  let m, last = null;
  while ((m = re.exec(text))) if (/function\s+control\s*\(/.test(m[1])) last = m[1];
  if (!last) return { ok: false, why: 'no fenced program with function control(...)' };
  return { ok: true, src: last.replace(/\s+$/, '') + '\n' };
}

module.exports = { MODELS, callLLM, applyDiff, extractProgram };
