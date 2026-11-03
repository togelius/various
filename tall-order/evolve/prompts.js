// Prompt construction for the LLM operator, in the manner of AlphaEvolve: a parent program, a few inspirations from
// other niches, the evaluator's feedback on the parent, and an instruction chosen by a small bandit over "hints".
const { LIMITS } = require('./validate');
const { AXES } = require('./archive');

const BRIEF = `You are evolving a bot controller, written as a small JavaScript function, for "Tall Order": a first-person shooter about climbing a six-floor tower of toy bricks to a flag on top.

GAME FACTS THAT MATTER
- You are a plastic figure. You walk (forward/back), turn, jump, fire a blaster that never runs out, and can use pickups. You never look up or down.
- The blaster only reaches foes within a 12 degree band above/below your hip. A foe on a different floor is out of reach from underneath it but in reach from far enough back (the band is an angle), so backing away from something a floor up/down can bring it into reach. foe.band says whether it is hittable right now.
- Floors are 3.8 high (floor index 0 = the rug, 5 = the top). Each floor has ONE way up, and o.goal points at it:
  stairs(-approach) -> walk up them; spring -> walk onto the pad and it throws you up; lift -> stand on it, it rises when you stand there;
  ladder-approach / ladder -> the lattice can only be climbed by pushing into it FROM THE EAST, facing WEST (yaw near +-PI), then holding move=1;
  boss -> the MEGA WOLF on the top floor must be beaten (150 hp) before the crane steps (crane-step) appear and spiral up to the flag.
- Toys: wolf (melee swipe, throws bricks), kitty (fast, pounces, swarms), bee (dives), golem (slow, slams, shockwave: jump it), car (revs then charges, knocks you off edges), cannon (lobbed shells; shootable), eagle (grabs you and carries you up; jump to let go), boss.
- Walking off an edge is a long fall: more than ~6 m kills you. o.drop.f/l/r give the distance to a drop ahead / left / right (9 = none). Falling or dying sends you back to your checkpoint, and time runs out.
- If you hang from a ledge (o.hang) press jump to climb up. A kitty on your head (o.rider): jump repeatedly and turn hard left then right. Carried by the eagle (o.carried): jump to let go.
- Pickups (o.inv): rocket, confetti, bomb, mallet, zap, balloon (use = true uses the selected one; sel picks slot 0..3). Walk over items on the ground (o.items) to collect them (juice heals).

CONTROLLER API
Write a script that defines \`function step(o, m)\`. It is called 10 times a second. \`m\` is a plain object that persists for the episode (use it for memory; it starts empty). Return an object with any of:
  turn  -1..1   positive turns toward positive bearings (to the right); the turn rate scales with it
  move  -1..1   forward (+) / backward (-)
  fire  bool    hold the trigger (fires when the aim band holds a target)
  jump  bool
  use   bool    use the selected pickup (edge: once per tick it is true)
  sel   0..3    select inventory slot
Observation o (all bearings b are radians relative to where you face, in -PI..PI, positive = to your right/clockwise-from-above; d = horizontal distance in metres; dy = height difference, target minus you):
  t, hp (0-100), x, y, z, yaw, floor (0-5), ground, hang, carried, rider, dead, climbing, speed, vy, head
  goal  {kind, d, b, ...}   where to go next. kinds: stairs-approach, stairs, spring, lift (also liftY, liftMode), ladder-approach, ladder, boss, crane, crane-step (stepY), flag
  aim   {hit, out, dir}     what the blaster would hit now (name or null); out = something in line but outside the band, dir +1 above / -1 below
  drop  {f, l, r}           distance to a drop ahead/left/right (9 = none)
  foes  [{k, d, b, dy, hp, st, awake, band}] up to 8 nearest alive toys; st is the toy's state ('windup','rev','slam','crouch','dive','throw','chase', ...) - wind-up states are telegraphed attacks
  shots [{k, shootable, d, b, dy}] incoming hostile projectiles (shells, bricks)
  items [{k, d, b, dy}]    pickups lying nearby on your floor
  inv   [{k, n}], sel
There is no strafing. Only the listed fields exist; do not invent others. Use Math.* freely. NO while/do loops, no recursion, no globals, no async. \`for (const f of o.foes)\` and bounded \`for (let i=0;i<n;i++)\` are fine.

HARD LIMIT: the controller must be at most ${LIMITS.maxChars} characters and ${LIMITS.maxLines} lines (comments count). Short, readable, well-chosen rules beat long ones.

HOW IT IS SCORED
The controller is run on a fresh set of random starting situations each epoch: different floors, positions on the floor, headings, health and starting pickups (it does NOT always start at the bottom). Score = progress up the tower from where it started (0..1, 1 = reached the flag), averaged over starts, within a time budget. So the controller must be general: it cannot assume where it is. Each controller is also placed on a map by two measured playstyle descriptors:
  trigger = fraction of ticks with the fire button held (rows of the map), pace = average walking speed / full walking speed.
`;

const HINTS = [
  { id: 'stuck', text: 'Study the failure analysis. Find the most common place or situation where this controller stops making progress, and fix that specifically.' },
  { id: 'survive', text: 'Improve survival: dodge telegraphed attacks (golem slam, car charge, cannon shells, brick throws) by moving or jumping at the right moment, and avoid walking off edges.' },
  { id: 'fight', text: 'Improve how it fights: turn to face the nearest awake foe, back away to bring foes that are on a different floor into the aim band, and shoot only when something is hittable.' },
  { id: 'items', text: 'Use pickups well: select a slot and use it when a golem, the boss, a crowd or a car is close and in front; walk over nearby item pickups when it is safe, especially juice when hp is low.' },
  { id: 'special', text: 'Handle the special states: hanging from a ledge, a kitty on the head, being carried by the eagle, and the lift/spring/ladder mechanics described above.' },
  { id: 'boss', text: 'Make it better at the top floor: beat the MEGA WOLF (circle at range, jump the shockwave, keep shooting), then climb the crane steps to the flag.' },
  { id: 'simplify', text: 'Simplify: remove rules that do not help, merge duplicated logic, and keep the behaviour at least as good. Shorter is better, provided progress does not drop.' },
  { id: 'novel', text: 'Change the strategy substantially: keep the interface but play in a distinctly different style from the parent (for example a cautious sniper that retreats to shoot, or a runner that ignores most toys and relies on speed and jumping).' },
  { id: 'tune', text: 'Tune: adjust thresholds and gains (turn gain, distances at which to shoot or flee, hp levels for healing) to increase progress. Make a few small, targeted numeric or logical changes.' },
  { id: 'memory', text: 'Use the memory object m: remember something across ticks (for example how long you have been stuck, the last position, a state machine for approaching the ladder) and use it to escape loops.' },
];

const FORMAT_DIFF = `OUTPUT FORMAT
Reply with one or more edit blocks against the PARENT, and nothing else of importance. Each block:
<<<<<<< SEARCH
(exact text copied from the parent)
=======
(replacement text)
>>>>>>> REPLACE
SEARCH text must occur exactly once in the parent. You may add a short comment line before the blocks stating the idea.`;
const FORMAT_FULL = `OUTPUT FORMAT
Reply with the complete new controller in a single \`\`\`js code block (the whole file, defining function step). You may add one short sentence of explanation before it.`;

function fmtDesc(g) { return `trigger ${g.desc[0].toFixed(2)} (${AXES[0].label[g.cell[0]]}), pace ${g.desc[1].toFixed(2)} (${AXES[1].label[g.cell[1]]})`; }
function feedback(g) {
  const s = g.summary; if (!s) return '(not yet evaluated)';
  const lines = [`mean progress ${g.cur.toFixed(3)}; reached the flag in ${s.wins}/${s.n} starts; mean knockouts per start ${s.deaths.toFixed(1)}; ${fmtDesc(g)}`];
  lines.push('per starting floor: ' + s.byFloor.map(f => `f${f.floor}: progress ${f.progress.toFixed(2)}${f.win ? ' (win)' : ''}, deaths ${f.deaths}${f.killedBy.length ? ' [' + f.killedBy.join(',') + ']' : ''}`).join(' | '));
  if (s.stuck.length) lines.push('where it ended without finishing: ' + s.stuck.join('; '));
  if (s.errors.length) lines.push('runtime errors: ' + s.errors.join('; '));
  return lines.join('\n');
}

function parentBlock(g) { return `PARENT (score ${g.cur.toFixed(3)}, ${g.code.length} chars)\n\`\`\`js\n${g.code}\n\`\`\``; }
function inspBlock(g, i) { return `INSPIRATION ${i + 1} (score ${g.cur.toFixed(3)}; ${fmtDesc(g)})\n\`\`\`js\n${g.code}\n\`\`\``; }
const libBlock = lib => lib.trim() ? `HELPER LIBRARY (already defined before your code in the same scope; you may call these, they do not count toward the size limit; do not redefine them)\n\`\`\`js\n${lib}\n\`\`\`\n` : '';

function mutationPrompt({ parent, inspirations, hint, target, lib, mode }) {
  let p = BRIEF + '\n' + libBlock(lib);
  p += '\n' + parentBlock(parent) + '\n\nEVALUATOR FEEDBACK ON THE PARENT\n' + feedback(parent) + '\n';
  if (inspirations.length) p += '\n' + inspirations.map(inspBlock).join('\n\n') + '\n';
  p += '\nYOUR TASK\n' + hint.text + '\n';
  if (target) p += `Aim for a controller that plays at about trigger ${target[0].toFixed(2)} and pace ${target[1].toFixed(2)}: ${AXES[0].label[target.cell[0]]} / ${AXES[1].label[target.cell[1]]} (this fills an empty niche on the map; progress still matters most).\n`;
  p += `Stay within ${LIMITS.maxChars} characters.\n\n` + (mode === 'diff' ? FORMAT_DIFF : FORMAT_FULL);
  return p;
}
function crossoverPrompt({ a, b, hint, lib }) {
  let p = BRIEF + '\n' + libBlock(lib);
  p += `\nPARENT A (score ${a.cur.toFixed(3)}; ${fmtDesc(a)})\n\`\`\`js\n${a.code}\n\`\`\`\nFeedback on A:\n${feedback(a)}\n`;
  p += `\nPARENT B (score ${b.cur.toFixed(3)}; ${fmtDesc(b)})\n\`\`\`js\n${b.code}\n\`\`\`\nFeedback on B:\n${feedback(b)}\n`;
  p += `\nYOUR TASK\nCombine the best ideas of A and B into one controller that scores higher than either: keep what each does well where the feedback shows the other fails. ${hint.id === 'simplify' ? hint.text : ''}\nStay within ${LIMITS.maxChars} characters, so be selective.\n\n` + FORMAT_FULL;
  return p.replace('PARENT A', 'PARENT A').replace(/PARENT B/, 'PARENT B');
}
function repairPrompt({ g, reason, lib }) {
  return BRIEF + '\n' + libBlock(lib) + `\nThe following controller was rejected: ${reason}\n\`\`\`js\n${g.code}\n\`\`\`\n\nYOUR TASK\nFix the problem with as few changes as possible, keeping the behaviour, and respecting the ${LIMITS.maxChars}-character limit. If it is too long, remove the least useful rules.\n\n` + FORMAT_FULL;
}
function libPrompt({ elites, lib }) {
  let p = BRIEF + '\n' + libBlock(lib) + '\nHere are the best controllers found so far.\n';
  elites.forEach((g, i) => p += `\nCONTROLLER ${i + 1} (score ${g.cur.toFixed(3)})\n\`\`\`js\n${g.code}\n\`\`\`\n`);
  p += `\nYOUR TASK\nWe are building a shared helper library so future controllers can be shorter and better. Identify 1-4 small, reusable helper functions that these controllers re-implement or that would clearly help (for example: clamp, steering toward a bearing, picking the nearest awake foe that is hittable, deciding whether an incoming shot is dangerous, a stuck detector using m). Write ONLY the new functions (plain function declarations, pure given their arguments, names not already in the library, no while/do loops, no globals). At most ${LIMITS.libChars - 0} characters in total across the whole library, including what exists.\n\nOUTPUT FORMAT\nOne \`\`\`js block containing only the new function declarations.`;
  return p;
}

function extractCode(text) {
  const blocks = [...text.matchAll(/```(?:js|javascript)?\s*\n([\s\S]*?)```/g)].map(m => m[1]);
  if (blocks.length) return blocks.sort((a, b) => b.length - a.length)[0].trim() + '\n';
  return /function\s+step\s*\(/.test(text) ? text.trim() + '\n' : null;
}
// returns {code} or {error}
function applyDiff(parent, text) {
  const re = /<<<<<<<\s*SEARCH\s*\n([\s\S]*?)\n=======\s*\n([\s\S]*?)\n?>>>>>>>\s*REPLACE/g;
  let code = parent, n = 0, m;
  while ((m = re.exec(text))) {
    const [, s, r] = m; const at = code.indexOf(s);
    if (at < 0) return { error: 'SEARCH text not found in the parent' };
    if (code.indexOf(s, at + 1) >= 0) return { error: 'SEARCH text is ambiguous' };
    code = code.slice(0, at) + r + code.slice(at + s.length); n++;
  }
  if (!n) { const full = extractCode(text); return full ? { code: full, note: 'fell back to full code' } : { error: 'no edit blocks and no code' }; }
  return { code };
}
module.exports = { BRIEF, HINTS, mutationPrompt, crossoverPrompt, repairPrompt, libPrompt, extractCode, applyDiff };
