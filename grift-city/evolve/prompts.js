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
  o.rays         7 clear distances to a wall or prop, up to 20 m, at bearings [-90, -45, -20, 0, 20, 45, 90] degrees (index 3 is straight ahead; negative is left)
  o.cars         up to 6 nearest vehicles within 45 m: {f, r, d, b, spd, vf (speed along your heading), kind: 'parked' | 'traffic' | 'cop' | 'wreck', len, wid, free, goal}
  o.peds         up to 6 nearest people within 30 m: {f, r, d, b, kind: 'civ' | 'cop' | 'gang', hostile, down, goal}
  o.enter        null, or the car you could climb into right now by pressing use: {d, b, free, goal}

Action (all optional):
  on foot:   move -1..1 (forward/back), strafe -1..1 (right positive), turn -1..1 (turn right when positive; full turn is 3.2 rad/s), sprint (bool, needs move > 0.5)
  in a car:  steer -1..1 (right positive), gas 0..1, brake 0..1 (brake with the car rolling forwards; once stopped, holding brake reverses), hand (handbrake, bool), horn
  both:      use (bool: get in/out of a car; an edge, so pulse it), skip (advance dialogue), retry (restart a failed job, only while o.ui.retry), choose 1-4 (pick a dialogue option), talk (hold: negotiate/con the person in front of you), fire, aim, weapon 1-9 (select), jump, crouch, evade, reload

HOW IT IS SCORED
Each controller is run on several random STARTS: a random place in the city 120-450 m from Voss Motors (training and held-out neighbourhoods differ), on foot (sometimes with a free car parked nearby) or already driving, at a random hour, dry or raining, with 40-100 health, sometimes already wanted. Different jobs may be next. You get about 2 minutes (110-140 game seconds) per start. QUALITY IS PROGRESS ONLY (points / 10, averaged over starts): up to 3 points for closing the distance to the first marker, 2 for starting the job there, 1 for every further objective reached (up to 5), 5 for passing the job and 5 more for each further job. Nothing rewards style, speed beyond progress, or violence. So the controller must work from ANY start: it cannot assume where it is, whether it has a car, or what the time is.
Each controller is also placed on a MAP of play styles by two measured numbers: ${AXES[0].name} (${AXES[0].desc}: 0 = always on foot, 1 = always in a car) and ${AXES[1].name} (${AXES[1].desc}). Different styles that make progress are all valuable.

HARD LIMIT: at most ${limits.maxChars} characters and ${limits.maxLines} lines in total, comments included (anything longer is rejected). Short, clear rules that handle many situations beat long ones.
`;

const HINTS = [
  { id: 'route', text: 'Improve how it follows the route: steer smoothly toward o.gps.b, use b2/b3 to anticipate a bend and slow down for it, and use o.rays to stay off walls and props.' },
  { id: 'stuck', text: 'Study the diagnostics. Where does this controller stop making progress (stuck against a wall, circling, waiting at a marker)? Add a stuck detector using m (position not changing for ~2 s) and a recovery (reverse and turn when driving; sidestep, turn away from the nearest ray and back off when walking), and fix that specifically.' },
  { id: 'car', text: 'Make better use of cars: when one is free nearby (o.enter, o.cars with free and kind parked) and the goal is far, walk to it and press use; drive along o.gps in the right-hand lane at a speed that suits the bend; leave the car when the goal is close and the car has nearly stopped.' },
  { id: 'arrive', text: 'Improve the arrival: a job only starts when you are ON FOOT inside the marker. Handle the last 20 m: stop the car, get out, walk into the marker, then skip the dialogue. Also handle retry/dialogue/choice prompts so no time is wasted.' },
  { id: 'job', text: 'Look at what happens after the marker: read o.mission.text and o.goal.kind. Make the controller keep making progress through the job (walk to person goals and hold talk when close; get into a car goal and drive it; follow the goal marker to the next objective).' },
  { id: 'traffic', text: 'Avoid collisions: use o.cars, o.peds and o.rays to brake or steer around vehicles and people ahead (not parked ones in the next lane), slow at bends, and keep to the lane. Crashing hurts and wrecks the car.' },
  { id: 'cops', text: 'Deal with the police: when o.me.wanted > 0 or a cop car is near, stay away from them, do not stop in their path, and keep making progress rather than standing still.' },
  { id: 'survive', text: 'Improve survival: the run ends on death or arrest. React to low hp, to hostile people nearby (o.peds hostile), to a burning car (get out), and to a wrecked car (get out and walk or take another).' },
  { id: 'violence', text: 'Change the playstyle toward more trouble: if a weapon is held, aim and fire at hostile or gang people in the way, or take (jack) a nearby moving car when it saves time, while still making progress. Accept a higher wanted level only when it pays.' },
  { id: 'peaceful', text: 'Change the playstyle toward fewer offences: never hit pedestrians, do not carjack, avoid cops, and make progress anyway.' },
  { id: 'novel', text: 'Change the strategy substantially while keeping the interface: play in a distinctly different style from the parent (for example a pure pedestrian that takes shortcuts across plazas and sprints everywhere, or a car-first player that always finds a vehicle before heading for the goal).' },
  { id: 'simplify', text: 'Simplify: remove rules that do not help, merge duplicated logic, shorten the code, and keep the behaviour at least as good. Shorter is better provided progress does not drop.' },
  { id: 'tune', text: 'Tune: adjust thresholds and gains (turn gain, target speeds, distances to brake, when to leave the car, sprint conditions) with a few small, targeted numeric or logical changes, to increase progress.' },
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
  let t = `  ${r.start} [${bits.join(', ')}]: ${r.points.toFixed(1)} pts, ended ${r.ended}${r.ended === 'dead' ? ' at ' + Math.round(r.t) + ' s' : ''}`;
  if (r.started) t += `; started ${r.started}${r.passed ? ', passed ' + r.passed : ''}`; else t += `; marker ${r.approach >= 0.95 ? 'reached but job not started' : 'not reached (closed ' + Math.round(r.approach * 100) + '% of ' + r.d0 + ' m, ' + r.dEnd + ' m left)'}`;
  t += `; ${Math.round(r.dFoot)} m on foot, ${Math.round(r.dCar)} m driving`;
  if (r.stuck > 4) t += `; stuck ${r.stuck} s`; if (r.offences) t += `; ${r.offences} offences`; if (r.firstError) t += `; ERROR ${r.firstError}`;
  const ev = (r.events || []).filter(e => !/first objective/.test(e.text)).slice(0, 4).map(e => Math.round(e.t) + 's ' + e.text).join(', '); if (ev) t += `\n      events: ${ev}`;
  const nt = (r.notes || []).slice(-3).join(' | '); if (nt) t += `\n      game said: ${nt}`;
  return t;
}
function feedback(g, axes = AXES) {
  const e = g.eval; if (!e) return '(not yet evaluated)';
  const lines = [`mean quality ${g.cur.toFixed(3)} over ${e.results.length} starts (it started the job in ${e.agg.started}, passed it in ${e.agg.passed}, died or was arrested in ${e.agg.deaths}); playstyle: ${fmtDesc(g, axes)}`];
  for (const r of e.results.slice(0, 6)) lines.push(startLine(r));
  return lines.join('\n');
}

const parentBlock = g => `PARENT (quality ${g.cur.toFixed(3)}, ${g.code.length} chars)\n\`\`\`js\n${g.code}\n\`\`\``;
const inspBlock = (g, i, axes) => `INSPIRATION ${i + 1} (quality ${g.cur.toFixed(3)}; ${fmtDesc(g, axes)})\n\`\`\`js\n${g.code}\n\`\`\``;

function mutationPrompt({ parent, inspirations = [], hint, target, mode, limits = LIMITS, axes = AXES }) {
  let p = brief(limits) + '\n' + parentBlock(parent) + '\n\nHOW THE PARENT ACTUALLY PLAYED (evaluator diagnostics)\n' + feedback(parent, axes) + '\n';
  if (inspirations.length) p += '\n' + inspirations.map((g, i) => inspBlock(g, i, axes)).join('\n\n') + '\n';
  p += '\nYOUR TASK\n' + hint.text + '\n';
  if (target) p += `Aim for a controller that plays at about ${axes[0].name} ${target.desc[0].toFixed(2)} (${axes[0].label[target.cell[0]]}) and ${axes[1].name} ${target.desc[1].toFixed(2)} per minute (${axes[1].label[target.cell[1]]}): that niche of the map is empty. Progress still matters most.\n`;
  p += `Stay within ${limits.maxChars} characters and ${limits.maxLines} lines.\n\n` + (mode === 'diff' ? FORMAT_DIFF : FORMAT_FULL);
  return p;
}
function crossoverPrompt({ a, b, hint, limits = LIMITS, axes = AXES }) {
  let p = brief(limits);
  p += `\nPARENT A (quality ${a.cur.toFixed(3)}; ${fmtDesc(a, axes)})\n\`\`\`js\n${a.code}\n\`\`\`\nHow A played:\n${feedback(a, axes)}\n`;
  p += `\nPARENT B (quality ${b.cur.toFixed(3)}; ${fmtDesc(b, axes)})\n\`\`\`js\n${b.code}\n\`\`\`\nHow B played:\n${feedback(b, axes)}\n`;
  p += `\nYOUR TASK\nCombine the best ideas of A and B into one controller that makes more progress than either: keep what each does well where the diagnostics show the other failing. ${hint && hint.id === 'simplify' ? hint.text : ''}\nStay within ${limits.maxChars} characters and ${limits.maxLines} lines, so be selective.\n\n` + FORMAT_FULL;
  return p;
}
function repairPrompt({ g, reason, limits = LIMITS }) {
  return brief(limits) + `\nThe following controller was REJECTED before it could play: ${reason}\n\`\`\`js\n${g.code}\n\`\`\`\n\nYOUR TASK\nFix the problem with as few changes as possible, keeping the behaviour, and respect the ${limits.maxChars}-character / ${limits.maxLines}-line limit. If it is too long, remove or compress the least useful rules.\n\n` + FORMAT_FULL;
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
module.exports = { brief, HINTS, mutationPrompt, crossoverPrompt, repairPrompt, extractCode, applyDiff, feedback, startLine, fmtDesc };
