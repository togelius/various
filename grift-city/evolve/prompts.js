// Prompt construction for the LLM variation operator, in the manner of AlphaEvolve: a parent program, inspirations from
// other niches, the evaluator's account of how the parent actually played, and one instruction drawn by a bandit from a
// list of hints. Programs come back as SEARCH/REPLACE diffs (mostly) or whole rewrites.
'use strict';
const { LIMITS } = require('./sandbox');
const { AXES } = require('./archive');

const brief = limits => `You are evolving a game-playing controller, written as JavaScript source, for GRIFT CITY: a small open-world 3D crime game in a city of 10x10 blocks (about 800 m across) with sidewalks, roads, traffic, pedestrians and police. You play a grifter taking jobs from a fixer called Marla at VOSS MOTORS.

THE GAME, AS FAR AS A CONTROLLER NEEDS IT
- A job starts when you are ON FOOT and walk into the yellow marker (the goal) outside Voss Motors, within about 2 m. If you are in a car when you get close the game tells you to get out first (press use). A short conversation then plays: press skip to get through it (o.ui.dialogue is true). If a job fails, o.ui.retry is true for a while and pressing retry restarts it (skip does not).
- After a job starts, the goal moves from objective to objective (o.goal, o.mission.text says what to do). The first three jobs are: REPO MAN (take a red Falcata back from a debtor in Northgate: hold talk next to him to talk him down, or just take the car if he is not looking; then drive it to Voss Motors), SPECIAL DELIVERY (get in the Boxer van, drive the crate to Pier 9 in Southport before the clock runs out), COLLECTIONS (go to Teddy Lark's bar in Southport, deal with the goons, collect money, bring it back to Marla).
- People walk the sidewalks; cars drive the roads in lanes (right-hand traffic, so the right-hand lane is yours) and many are parked along the kerb. You can climb into a free (empty, unlocked) car within about 3 m with use, and get out with use. Taking a car with a driver in it is a carjacking (a crime). Hitting people, shooting, vandalism and carjacking are offences and raise your wanted level (o.me.wanted, 0-5); police then chase you. Dying or being arrested ends the run.
- You can walk (3.3 m/s, sprint 6.8 m/s) or drive (25-35 m/s at the top end, depending on the car). Cars have real handling: grip, understeer, wheel-spin, handbrake. Buildings are solid.

CONTROLLER CONTRACT
Write \`function think(o, m)\`. It is called 10 times a second with the observation o and a plain object m that persists for the whole run (use it for timers and state). It returns an action object; anything it leaves out is off/zero. Helper functions and constants are fine. Only Math is available (Math.random is deterministic). No loops except bounded \`for\`; no while/do, no recursion, no globals other than your own functions, no async, never throw.

Observation o (all numbers; distances in metres, angles in radians; a BEARING b is relative to the way you face and is POSITIVE TO THE RIGHT, so a target with b > 0 is on your right; f and r are metres ahead and to the right):
  o.t            seconds since the start;  o.hour  clock hour 0-24;  o.rain  0..1
  o.me           {x, z, h (heading), mode: 'foot' | 'car' | 'entering', spd (m/s, signed in a car), hp 0-100, armor, wanted 0-5, money, alive, weapon, ammo, fire}
  o.car          only in a car: {spd, lat (sideways speed), hp 0-1, len, wid, type, burning, air, yaw}
  o.ui           {dialogue, shop, retry, choice (array of option texts, or null)}
  o.mission      {name (current job or null), next (the next story job), done (jobs finished), timer (s left or -1), text (what the game tells the player to do)}
  o.goal         null, or {x, z, d, f, r, b, kind: 'place' | 'car' | 'person', free (for a car goal: nobody inside), spd, mine}. The objective marker, as on the map.
  o.gps          null, or the way to the goal along sidewalks (on foot) or roads (in a car): {d (route length left), b (bearing to the waypoint ahead), b2, b3 (bearings to the next two waypoints, so you can see a bend coming), wd (distance to the waypoint ahead)}
  o.rays         7 clear distances to a wall or prop, up to 20 m, at bearings [-90, -45, -20, 0, 20, 45, 90] degrees (index 3 is straight ahead; negative is left). Walls only.
  o.range        12 RANGEFINDERS all round, every 30 degrees clockwise from straight ahead (index 0 ahead, 3 right, 6 behind, 9 left): the clear distance up to 30 m, stopped by walls, props AND vehicles
  o.pie          PIE-SLICE sensors: 8 slices of 45 degrees round you, clockwise from ahead (index 0 ahead, 2 right, 4 behind, 6 left). For each kind {car, ped, cop, foe}, an array of 8 distances to the nearest one in that slice (50 = none within 50 m). car = any vehicle that is not wrecked, ped = an ordinary person, cop = police on foot or driving, foe = hostile or gang people
  o.road         {on (on the carriageway), off (metres right of the centre of the nearest lane going your way; negative = left of it), b (bearing of that lane's direction), d (distance to the lane centre)}
  o.enter        null, or the car you could climb into right now by pressing use: {d, b, free, goal}

Action (all optional):
  on foot:   move -1..1 (forward/back), strafe -1..1 (right positive), turn -1..1 (turn right when positive; full turn is 3.2 rad/s), sprint (bool, needs move > 0.5)
  in a car:  steer -1..1 (right positive), gas 0..1, brake 0..1 (brake with the car rolling forwards; once stopped, holding brake reverses), hand (handbrake, bool), horn
  both:      use (bool: get in/out of a car; an edge, so pulse it), skip (advance dialogue), retry (restart a failed job, only while o.ui.retry), choose 1-4 (pick a dialogue option), talk (hold: negotiate/con the person in front of you), fire, aim, weapon 1-9 (select), jump, crouch, evade, reload

HOW IT IS SCORED
Each controller is run on several random STARTS: a random place in the city 120-450 m from Voss Motors (training and held-out neighbourhoods differ), on foot (sometimes with a free car parked nearby) or already driving, at a random hour, dry or raining, with 40-100 health, sometimes already wanted. Different jobs may be next. You get about 4 minutes (250-285 game seconds) per start; a run in which you do not move for a minute is ended early. QUALITY (averaged over starts) = STORY + 0.25 x CASH + 0.1 x SURVIVAL:
  STORY (points / 10, the bulk of it): up to 3 points for closing the distance to the first marker, 2 for starting the job there, then for EVERY further objective up to 1 point for the fraction of the distance to it you close (1 when you reach it; up to 8 objectives), 5 for passing the job and 5 more for each further job.
  CASH: money made by any means during the run (job pay, cons, style chains for drifts and near misses, stunts, hidden packages) / $2000, at most 1.5.
  SURVIVAL: 0 if you are dead or arrested at the end, otherwise 0.5 + 0.5 x health.
Nothing rewards violence for its own sake. So the controller must work from ANY start: it cannot assume where it is, whether it has a car, or what the time is.
Each controller is also placed on a MAP of play styles by two measured numbers: ${AXES[0].name} (${AXES[0].desc}: 0 = always on foot, 1 = always in a car) and ${AXES[1].name} (${AXES[1].desc}). Different styles that make progress are all valuable.

HARD LIMIT: at most ${limits.maxChars} characters and ${limits.maxLines} lines in total, comments included (anything longer is rejected). Short, clear rules that handle many situations beat long ones. Functions in the HELPER LIBRARY (if one is shown) are already defined and do not count toward the limit.
`;

const HINTS = [
  { id: 'route', text: 'Improve how it follows the route: steer smoothly toward o.gps.b, use b2/b3 to anticipate a bend and slow down for it, and use o.range / o.rays to stay off walls, props and other cars, and o.road to keep to your lane.' },
  { id: 'stuck', text: 'Study the diagnostics. Where does this controller stop making progress (stuck against a wall, circling, waiting at a marker)? Add a stuck detector using m (position not changing for ~2 s) and a recovery (reverse and turn when driving; sidestep, turn away from the nearest ray and back off when walking), and fix that specifically.' },
  { id: 'car', text: 'Make better use of cars: when one is free nearby (o.enter, o.cars with free and kind parked) and the goal is far, walk to it and press use; drive along o.gps in the right-hand lane at a speed that suits the bend; leave the car when the goal is close and the car has nearly stopped.' },
  { id: 'arrive', text: 'Improve the arrival: a job only starts when you are ON FOOT inside the marker. Handle the last 20 m: stop the car, get out, walk into the marker, then skip the dialogue. Also handle retry/dialogue/choice prompts so no time is wasted.' },
  { id: 'job', text: 'Look at what happens after the marker: read o.mission.text and o.goal.kind. Make the controller keep making progress through the job (walk to person goals and hold talk when close; get into a car goal and drive it; follow the goal marker to the next objective).' },
  { id: 'traffic', text: 'Avoid collisions: use o.range (it sees vehicles too), o.pie, o.cars and o.peds to brake or steer around vehicles and people ahead (not parked ones in the next lane), slow at bends, and keep to the lane. Crashing hurts and wrecks the car.' },
  { id: 'cops', text: 'Deal with the police: when o.me.wanted > 0 or a cop car is near, stay away from them, do not stop in their path, and keep making progress rather than standing still.' },
  { id: 'survive', text: 'Improve survival: the run ends on death or arrest. React to low hp, to hostile people nearby (o.peds hostile), to a burning car (get out), and to a wrecked car (get out and walk or take another).' },
  { id: 'violence', text: 'Change the playstyle toward more trouble: if a weapon is held, aim and fire at hostile or gang people in the way, or take (jack) a nearby moving car when it saves time, while still making progress. Accept a higher wanted level only when it pays.' },
  { id: 'peaceful', text: 'Change the playstyle toward fewer offences: never hit pedestrians, do not carjack, avoid cops, and make progress anyway.' },
  { id: 'novel', text: 'Change the strategy substantially while keeping the interface: play in a distinctly different style from the parent (for example a pure pedestrian that takes shortcuts across plazas and sprints everywhere, or a car-first player that always finds a vehicle before heading for the goal).' },
  { id: 'simplify', text: 'Simplify: remove rules that do not help, merge duplicated logic, shorten the code, and keep the behaviour at least as good. Shorter is better provided progress does not drop.' },
  { id: 'tune', text: 'Tune: adjust thresholds and gains (turn gain, target speeds, distances to brake, when to leave the car, sprint conditions) with a few small, targeted numeric or logical changes, to increase progress.' },
  { id: 'sensors', text: 'Make better use of the sensors the parent ignores: o.range (rangefinders all round, they see cars), o.pie (pie slices: where cars, people, cops and foes are) and o.road (lane offset and direction). For example steer toward the most open rangefinder near the route bearing, keep o.road.off near 0 when driving, and slow when o.pie.ped or o.pie.car ahead is close.' },
  { id: 'library', text: 'Use the HELPER LIBRARY: replace code in the parent that re-implements something a library function already does with a call to it, then spend the freed characters on handling a situation the diagnostics show it failing in.' },
  { id: 'cash', text: 'Make some money on the way without losing story progress: drift (handbrake flick in a car, then keep the gas on), near misses and air chain into cash in a car; talk (hold) to a stranger on foot is a con that pays. Only where it costs little time.' },
  { id: 'memory', text: 'Use the memory object m: remember something across ticks (a state machine for "walk to car / drive / get out / walk in", a stuck timer, the last position) and use it to avoid loops.' },
];

const FORMAT_DIFF = `OUTPUT FORMAT
Reply with one or more edit blocks against the PARENT, and little else (a one-line idea before them is welcome). Each block:
<<<<<<< SEARCH
(text copied exactly from the parent; it must occur exactly once)
=======
(replacement text)
>>>>>>> REPLACE`;
const FORMAT_FULL = `OUTPUT FORMAT
Reply with the complete new controller in a single \`\`\`js code block (the whole file, defining function think), and at most one sentence of explanation before it.`;

const fmtDesc = (g, axes = AXES) => { const c = g.cell || [0, 0]; return `${axes[0].name} ${g.desc[0].toFixed(2)} (${axes[0].label[c[0]]}), ${axes[1].name} ${g.desc[1].toFixed(2)} per min (${axes[1].label[c[1]]})`; };

function startLine(r) {
  const i = r.info || {}, bits = [r.mode || '?', i.hour !== undefined ? i.hour + ':00' : '', i.rain ? 'rain' : '', i.hp < 100 ? 'hp ' + i.hp : '', i.wanted ? 'wanted ' + i.wanted : '', i.giverDist ? i.giverDist + ' m from Voss' : ''].filter(Boolean);
  let t = `  ${r.start} [${bits.join(', ')}]: quality ${(r.quality || 0).toFixed(2)} (${r.points.toFixed(1)} story points${r.cash ? ', $' + r.cash + ' made' : ''}), ended ${r.ended}${r.ended !== 'time' ? ' at ' + Math.round(r.t) + ' s' : ''}`;
  if (r.started) t += `; started ${r.started}${r.passed ? ', passed ' + r.passed : ''}`; else t += `; marker ${r.approach >= 0.95 ? 'reached but job not started' : 'not reached (closed ' + Math.round(r.approach * 100) + '% of ' + r.d0 + ' m, ' + r.dEnd + ' m left)'}`;
  t += `; ${Math.round(r.dFoot)} m on foot, ${Math.round(r.dCar)} m driving`;
  if (r.stuck > 4) t += `; stuck ${r.stuck} s`; if (r.offences) t += `; ${r.offences} offences`; if (r.firstError) t += `; ERROR ${r.firstError}`;
  const ev = (r.events || []).filter(e => !/first objective/.test(e.text)).slice(0, 4).map(e => Math.round(e.t) + 's ' + e.text).join(', '); if (ev) t += `\n      events: ${ev}`;
  const nt = (r.notes || []).slice(-3).join(' | '); if (nt) t += `\n      game said: ${nt}`;
  return t;
}
function feedback(g, axes = AXES) {
  const e = g.eval; if (!e) return '(not yet evaluated)';
  const lines = [`mean quality ${g.cur.toFixed(3)} (story ${(e.agg.story || 0).toFixed(2)}, cash ${(e.agg.cash || 0).toFixed(2)}, survival ${(e.agg.survival || 0).toFixed(2)}) over ${e.results.length} starts (it started the job in ${e.agg.started}, passed it in ${e.agg.passed}, died or was arrested in ${e.agg.deaths}); playstyle: ${fmtDesc(g, axes)}`];
  for (const r of e.results.slice(0, 6)) lines.push(startLine(r));
  return lines.join('\n');
}

const libBlock = lib => lib && lib.trim() ? `HELPER LIBRARY (already defined before your code, in the same scope: call these freely; they do not count toward your size limit; do not redefine them)\n\`\`\`js\n${lib.trim()}\n\`\`\`\n` : '';
const parentBlock = g => `PARENT (quality ${g.cur.toFixed(3)}, ${g.code.length} chars)\n\`\`\`js\n${g.code}\n\`\`\``;
const inspBlock = (g, i, axes) => `INSPIRATION ${i + 1} (quality ${g.cur.toFixed(3)}; ${fmtDesc(g, axes)})\n\`\`\`js\n${g.code}\n\`\`\``;

function mutationPrompt({ parent, inspirations = [], hint, target, mode, limits = LIMITS, axes = AXES, lib = '' }) {
  let p = brief(limits) + '\n' + libBlock(lib) + '\n' + parentBlock(parent) + '\n\nHOW THE PARENT ACTUALLY PLAYED (evaluator diagnostics)\n' + feedback(parent, axes) + '\n';
  if (inspirations.length) p += '\n' + inspirations.map((g, i) => inspBlock(g, i, axes)).join('\n\n') + '\n';
  p += '\nYOUR TASK\n' + hint.text + '\n';
  if (target) p += `Aim for a controller that plays at about ${axes[0].name} ${target.desc[0].toFixed(2)} (${axes[0].label[target.cell[0]]}) and ${axes[1].name} ${target.desc[1].toFixed(2)} per minute (${axes[1].label[target.cell[1]]}): that niche of the map is empty. Progress still matters most.\n`;
  p += `Stay within ${limits.maxChars} characters and ${limits.maxLines} lines.\n\n` + (mode === 'diff' ? FORMAT_DIFF : FORMAT_FULL);
  return p;
}
function crossoverPrompt({ a, b, hint, limits = LIMITS, axes = AXES, lib = '' }) {
  let p = brief(limits) + '\n' + libBlock(lib);
  p += `\nPARENT A (quality ${a.cur.toFixed(3)}; ${fmtDesc(a, axes)})\n\`\`\`js\n${a.code}\n\`\`\`\nHow A played:\n${feedback(a, axes)}\n`;
  p += `\nPARENT B (quality ${b.cur.toFixed(3)}; ${fmtDesc(b, axes)})\n\`\`\`js\n${b.code}\n\`\`\`\nHow B played:\n${feedback(b, axes)}\n`;
  p += `\nYOUR TASK\nCombine the best ideas of A and B into one controller that makes more progress than either: keep what each does well where the diagnostics show the other failing. ${hint && hint.id === 'simplify' ? hint.text : ''}\nStay within ${limits.maxChars} characters and ${limits.maxLines} lines, so be selective.\n\n` + FORMAT_FULL;
  return p;
}
function repairPrompt({ g, reason, limits = LIMITS, lib = '' }) {
  return brief(limits) + '\n' + libBlock(lib) + `\nThe following controller was REJECTED before it could play: ${reason}\n\`\`\`js\n${g.code}\n\`\`\`\n\nYOUR TASK\nFix the problem with as few changes as possible, keeping the behaviour, and respect the ${limits.maxChars}-character / ${limits.maxLines}-line limit. If it is too long, remove or compress the least useful rules.\n\n` + FORMAT_FULL;
}

// Continual Abstraction Discovery: ask for reusable helpers distilled from the best controllers. Append-only.
function libraryPrompt({ elites, lib = '', limits = LIMITS }) {
  let p = brief(limits) + '\n' + libBlock(lib) + '\nHere are the best controllers found so far, from different niches of the map.\n';
  elites.forEach((g, i) => { p += `\nCONTROLLER ${i + 1} (quality ${g.cur.toFixed(3)}; ${fmtDesc(g)})\n\`\`\`js\n${g.code}\n\`\`\`\n`; });
  p += `\nYOUR TASK\nWe keep a shared HELPER LIBRARY so that future controllers can be shorter and better: every controller runs with the library defined before it, and library code does not count toward a controller's ${limits.maxChars}-character limit. Find 1 to 4 small, reusable helper functions that several of these controllers re-implement, or that would clearly help any controller (for example: steering toward a bearing, picking the clearest rangefinder near a bearing, a stuck detector that keeps its state in m, choosing a free car worth walking to, deciding when to get out near the goal, speed for a bend from gps bearings, braking for what o.pie or o.range shows ahead). Rules: plain function declarations only; pure given their arguments (state goes in an m passed in); names not already in the library and not 'think'; no while/do loops, no globals, no recursion; documented with a one-line comment each; the whole library (existing plus new) at most ${limits.libChars} characters. Do not repeat existing functions.\n\nOUTPUT FORMAT\nOne \`\`\`js block containing ONLY the new function declarations.`;
  return p;
}
function extractCode(text) {
  const blocks = [...text.matchAll(/```(?:js|javascript)?[ \t]*\n([\s\S]*?)```/g)].map(m => m[1]);
  if (blocks.length) return blocks.sort((a, b) => b.length - a.length)[0].trim() + '\n';
  return /function\s+think\s*\(/.test(text) ? text.trim() + '\n' : null;
}
// returns { code } or { error }
function applyDiff(parent, text) {
  const re = /<<<<<<<\s*SEARCH[ \t]*\n([\s\S]*?)\n=======[ \t]*\n([\s\S]*?)\n?>>>>>>>\s*REPLACE/g;
  let code = parent, n = 0, m;
  while ((m = re.exec(text))) {
    const [, s, r] = m; const at = code.indexOf(s);
    if (at < 0) return { error: 'a SEARCH block was not found in the parent' };
    if (code.indexOf(s, at + 1) >= 0) return { error: 'a SEARCH block matched more than once' };
    code = code.slice(0, at) + r + code.slice(at + s.length); n++;
  }
  if (!n) { const full = extractCode(text); return full ? { code: full, note: 'full code instead of edits' } : { error: 'no edit blocks and no code block' }; }
  return { code };
}
module.exports = { brief, HINTS, mutationPrompt, crossoverPrompt, repairPrompt, libraryPrompt, libBlock, extractCode, applyDiff, feedback, startLine, fmtDesc };
