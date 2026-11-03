/* The prompt sampler: what an operator shows the LLM.
 *
 * After AlphaEvolve, the context is rich: the parent's code, how it scored on
 * every run, maps of the places it failed, inspiration programs drawn from
 * elsewhere in the archive with their scores, and the archive itself, so the
 * model can see which playstyles are thin.
 *
 * After ELMER, mutation strength is an explicit dial - small, medium, large -
 * rather than one undifferentiated "improve this". And after ProFiT's
 * self-modification loop, the medium operator is a reflection step: the
 * program's own failure record comes back to it, and the change is meant to
 * answer that record.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { LIMITS } = require('./sandbox');
const { DIMS } = require('./archive');

const SPEC = fs.readFileSync(path.join(__dirname, 'SPEC.md'), 'utf8');

const SYSTEM = `You are an expert game-AI programmer taking part in an evolutionary search over controller programs for the game VANGUARD ZERO. Each request shows you controllers from the search, how they scored, and one specific change to make. Think about the game mechanics before you write. Answer with only the output format the request asks for - no explanations outside it.

${SPEC}`;

const STAGE = ['stage 1 (Skyfall Ridge)', 'stage 2 (Magma Foundry)', 'stage 3 (Void Citadel)'];

function endText(t) {
  const why = {
    'died:pit': 'fell into a pit', 'died:liquid': 'fell into liquid', 'died:spike': 'killed by spikes',
    'died:contact': 'killed touching an enemy', 'died:shot': 'shot dead', 'died:flame': 'burned by a flame vent',
    'died:boss': 'killed by the boss', 'died:damage': 'killed by damage', 'died:other': 'killed',
    stalled: 'stalled (no new ground for 12 s)', time: 'ran out of time', timeout: 'a frame took too long',
    reached: 'reached the boss gate', won: 'beat the boss'
  }[t.end] || t.end;
  return why;
}

function taskTable(res) {
  return res.tasks.map(t => {
    const where = t.kind === 'boss' ? STAGE[t.stage] + ' boss fight      '
      : (STAGE[t.stage] + ' from x=' + t.x0).padEnd(34);
    const what = t.kind === 'boss'
      ? 'boss health removed ' + Math.round(t.progress * 100) + '%; ' + endText(t)
      : Math.round(t.progress * 100) + '% of the way; ' + endText(t) + (t.end === 'reached' ? '' : ' at x=' + t.at.x + ', y=' + t.at.y);
    return '  ' + where + ' ' + what + '  [' + t.shots + ' shots, ' + t.kills + ' kills, -' + t.hpLost + ' hp]';
  }).join('\n');
}

/* The static map around a failure point, with the player marked. Rendered
 * from a booted level, so it shows exactly the tiles the controller saw. */
function mapAround(world, stage, x, y) {
  const { VZ, game: g } = world;
  if (g.stageIndex !== stage || !g.level) { g.loadStage(stage, false); }
  const lv = g.level, T = VZ.TILE;
  const ch = { 0: '.', 1: '#', 2: '=', 3: '^', 4: '^', 5: '~', 6: 'c', 7: '>', 8: '<', 9: '|', 10: '^', 11: '^' };
  const ptx = Math.floor(x / T), pty = Math.floor(y / T);
  const rows = [];
  for (let ty = pty - 8; ty <= pty + 5; ty++) {
    let s = '';
    for (let tx = ptx - 14; tx <= ptx + 14; tx++) {
      if (tx === ptx && ty === pty) { s += '@'; continue; }
      if (ty >= lv.h) { s += ' '; continue; }
      s += ch[lv.at(tx, ty)] || '.';
    }
    rows.push('    ' + s);
  }
  return rows.join('\n');
}

/* The failures worth showing: grouped by place, most frequent first, so a pit
 * that kills from five different starts is shown once and shown first. */
function failureViews(world, res, max = 2) {
  const groups = {};
  for (const t of res.tasks) {
    if (t.kind !== 'run' || t.end === 'reached') continue;
    const k = t.stage + ':' + Math.round(t.at.x / 96);
    (groups[k] = groups[k] || []).push(t);
  }
  const ranked = Object.values(groups).sort((a, b) => b.length - a.length).slice(0, max);
  return ranked.map(g => {
    const t = g[0];
    // A fall is decided where the player left the ground, not where it died.
    const fell = (t.end === 'died:pit' || t.end === 'died:liquid') && t.from;
    const c = fell ? t.from : t.at;
    const where = fell ? '@ = the last place it was standing before it fell; it died at x=' + t.at.x
                       : '@ = where the player was';
    return '  ' + STAGE[t.stage] + ', x=' + t.at.x + ': ' + endText(t) + ' - ' + g.length + ' run' + (g.length > 1 ? 's' : '') +
      ' ended here. Map (' + where + '; # solid, = one-way platform, ^ spikes, ~ liquid, c crumbling; blank = below the map):\n' +
      mapAround(world, t.stage, c.x, c.y);
  }).join('\n\n');
}

function styleOf(ind) {
  return 'aggression ' + ind.aggression.toFixed(2) + ' (' + (ind.aggression * 4).toFixed(1) + ' shots/s), entropy ' + ind.entropy.toFixed(3);
}
function header(tag, ind) {
  return tag + ' [quality ' + ind.quality.toFixed(3) + ' | ' + styleOf(ind) + ' | ' + ind.size + ' chars]';
}
function codeBlock(src) { return '```js\n' + src.replace(/\s+$/, '') + '\n```'; }

function archiveSection(archive, mark) {
  const b = archive.best();
  return `# The search so far
The archive is a grid of playstyles. Across: aggression, shots fired per second divided by 4 (0 = never shoots, 1 = fires as fast as the gun allows). Up: action entropy, how varied the movement and jump inputs are over time (Talakat's measure: the entropy of the 1st-3rd derivatives of the input sequence; low = holding inputs steadily, high = constantly changing them). Each cell keeps the highest-quality controller in that style.

${archive.grid({ mark })}

Best quality anywhere: ${b ? b.quality.toFixed(3) : '-'}. Cells filled: ${archive.elites().length} of ${DIMS[0].bins * DIMS[1].bins}.`;
}

function parentSection(world, p, res, tag = 'The controller to change') {
  return `# ${header(tag, p)}
${codeBlock(p.src)}

## How it did on each run (quality is the mean of these)
${taskTable(res)}

## Where its runs ended most often
${failureViews(world, res) || '  (no level-run failures)'}`;
}

function inspirationSection(list) {
  if (!list.length) return '';
  return '# Other controllers from the archive, for ideas\n' + list.map(x =>
    '## ' + header(x.why, x.ind) + '\n' + codeBlock(x.ind.src)).join('\n\n');
}

const DIFF_FORMAT = `# Output format
Answer with one or more edit blocks and nothing else:

<<<<<<< SEARCH
lines copied exactly from the current program
=======
the replacement lines
>>>>>>> REPLACE

Each SEARCH must match exactly one place in the program. Keep the program under ${LIMITS.MAX_CHARS} characters in total. If the change alters the strategy, also edit the "// intent:" line.`;

const FULL_FORMAT = `# Output format
Answer with the complete new program in a single \`\`\`js fenced block and nothing else. It must start with a "// intent:" line, define function control(obs, mem), and be under ${LIMITS.MAX_CHARS} characters in total, comments included.`;

function styleTarget(range) {
  const [a, e] = range;
  return `aggression between ${a[0].toFixed(1)} and ${a[1].toFixed(1)} (${(a[0] * 4).toFixed(1)}-${(a[1] * 4).toFixed(1)} shots per second) and action entropy between ${e[0].toFixed(2)} and ${e[1].toFixed(2)}`;
}

const TASKS = {
  // ELMER's mutation strengths: small...
  tweak: () => `# Your task: a small change
Make one small, targeted change that fixes the most frequent failure above. Keep the strategy and playstyle the same.`,
  // ...medium, as reflection on the program's own record (ProFiT)...
  improve: p => `# Your task: reflect, then improve
Study the run results and failure maps above. Work out *why* this controller fails where it does - what in its logic leads there - then make a substantive improvement that addresses that cause. Keep its playstyle (${styleOf(p)}); the quality is what should change.`,
  // ...and large.
  rewrite: p => `# Your task: rewrite
Write a better controller from scratch for the same playstyle (${styleOf(p)}). Keep what works in the current one, fix what the results show is wrong, and borrow ideas from the other controllers where they help.`,
  crossover: (p, q) => `# Your task: combine two controllers
The controller above and the second parent below are good at different things - compare their run results. Write one child program that combines the strengths of both. Choose a coherent playstyle for it rather than averaging blindly.`,
  steer: (p, q, range) => `# Your task: a new playstyle
The archive has nothing good with ${styleTarget(range)}. Using the controller above as a starting point, write a controller that plays in that style - shoots that often, changes its inputs that much - while still making as much progress as it can.`,
  repair: (p, q, range, why) => `# Your task: make it feasible
This controller plays well but is infeasible: ${why}. It cannot enter the archive until that is fixed. Fix it while keeping its behaviour and its strategy - shorten the code, simplify, merge rules, drop comments if needed.`,
  init: (p, q, range) => `# Your task: a new controller
Write a new controller from scratch that plays with ${styleTarget(range)}, and makes as much progress through the game as it can.`
};

function build(op, ctx) {
  const parts = [archiveSection(ctx.archive, ctx.parent && ctx.parent.cell)];
  if (ctx.parent) parts.push(parentSection(ctx.world, ctx.parent, ctx.parentRes));
  if (ctx.parent2) parts.push(parentSection(ctx.world, ctx.parent2, ctx.parent2Res, 'The second parent'));
  parts.push(inspirationSection(ctx.inspirations || []));
  parts.push(TASKS[op](ctx.parent, ctx.parent2, ctx.range, ctx.why));
  parts.push(op === 'tweak' || op === 'improve' ? DIFF_FORMAT : FULL_FORMAT);
  return parts.filter(Boolean).join('\n\n');
}

module.exports = { SYSTEM, build, taskTable, failureViews, mapAround };
