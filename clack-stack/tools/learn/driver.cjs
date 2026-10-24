'use strict';
// The learner's one window on the game (DESIGN §18.8 G4, the learner quiz). A learner (a fresh agent who knows only what
// it sees here) plays the real game, index.html, in drive mode (?drive=1: a seeded clock that moves only when told) in
// headless Chromium at 390x844 with touch, one op at a time, and learns the rules from the pictures alone.
//
//   node tools/learn/driver.cjs --run=<n | folder> <op> [args]
//
// Ops (x, y in the game's own pixels: the screen is 390 wide and 844 tall; the rulers on every picture are in them):
//   start            begin a new run (3 at most): the game opens, its title is tapped and the first tile comes into the
//                    hand
//   move <x> [y]     put a finger down at x (y: 420 if not given), or slide the finger that is down to there; 0.1 s
//                    passes
//   lift             lift the finger (if no finger is down: a quick tap where it last was); the fall is filmed (8 frames
//                    over 1.1 s, in one picture) and time runs on until the next tile is in the hand (at most 2.5 s)
//   tap <x> [y]      a quick tap (down and up) at x, y (y: 420 if not given); 0.1 s passes (filmed like a lift when it
//                    lets go of a tile)
//   key <name>       a key press: ArrowLeft, ArrowRight, ArrowDown, Space, Enter, Escape, P, M, ...; 0.1 s passes
//                    (filmed like a lift when it lets go of a tile)
//   wait <ms>        let time pass (1 to 10000 ms)
//   zoom <picture> <x0> <y0> <x1> <y1>
//                    a part of one of the learner's own pictures (its game pictures, or the quiz sheets once handed
//                    out), enlarged, with a ruler in that picture's own pixels; it plays nothing and costs nothing
//   topics           the topics the write-up should cover (no rules in it; no picture)
//   status           the budget left (no picture)
//   stop             end this folder's background browser (the session's pictures and log stay)
// Each op writes one PNG (the screen at about 60%, with rulers) and prints its path; a lift also writes a filmstrip PNG
// of the fall (8 frames) and prints that path too. The budget is the learner's, over every run folder in its root:
// 3 runs or 150 lifts (tiles let go by a lift, tap or key), whichever comes first; an op past it is refused. Once the
// quiz is handed out (tools/learn/quiz.cjs --hand-out=<root>, which writes <root>/.closed) the game is closed: every op
// that plays is refused (zoom, topics and status still answer).
// A learner works in its own empty root, outside the rev5d scratch folder (which holds the quiz's key and the other
// learners' work): a root inside it is refused. The driver is the learner's only tool (DESIGN §18.8: any other tool call
// voids the run); zoom is there so that reading a picture closely needs nothing else.
//
// State: one session per run folder (--run=3 is <root>/run-3; root: $CLACK_LEARN_ROOT or <scratchpad>/learners/default;
// --run=<path> is that folder, its root the folder it is in). The session lives in a background browser (one per folder,
// started by the first op, ended after 30 idle minutes or by `stop`); if that is gone, the next op starts a new one and
// replays the log first (drive mode is deterministic: the same ops draw the same pictures). Files:
//   <folder>/png/NNNN-<op>.png, NNNN-<op>-film.png   the pictures
//   <folder>/ops.jsonl                                 every op as given, refused ones too, with its pictures
//   <folder>/.audit/audit.jsonl                        for the graders only: the game's state after every op (what each
//                                                      release did, the run, the tiles), and refusals
//   <folder>/.audit/session.json, daemon.json, daemon.log
// Graders: `--audit` prints the audit as a table; `--replay` replays the log in a fresh browser and checks every op
// against the audit (a run is reproducible).
// --direct runs the op in this process (no background browser: slower, every op replays the log).
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');
const L = require('./lib.cjs');

const LIMITS = { runs: 3, lifts: 150 };
const OPS = ['start', 'move', 'lift', 'tap', 'key', 'wait'];
// the rev5d scratch folder: the quiz's key, the graders' files and other learners' work live there, so no learner root may
const REV = path.dirname(L.SCRATCH);
const TOPICS = path.join(__dirname, 'topics.txt');
const KEYS = { space: 'Space', ' ': 'Space', enter: 'Enter', escape: 'Escape', esc: 'Escape', left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', up: 'ArrowUp',
  arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', arrowdown: 'ArrowDown', arrowup: 'ArrowUp', p: 'p', m: 'm', r: 'r', a: 'a', d: 'd', b: 'b', k: 'k', c: 'c', shift: 'Shift' };
const MOVE_T = 0.1, FILM = [0.05, 0.12, 0.2, 0.3, 0.42, 0.58, 0.8, 1.1], SETTLE_MAX = 2.5, PNG_SCALE = 0.6, FILM_SCALE = 0.5;
const Y_DEFAULT = 420, IDLE_MS = 30 * 60 * 1000;

const USAGE = `usage: node tools/learn/driver.cjs --run=<n|folder> <op> [args]
  start            begin a new run (at most 3): the game opens, its title is tapped, the first tile comes into the hand
  move <x> [y]     put a finger down at x (y 420 if not given), or slide the finger that is down there; 0.1 s passes
  lift             lift the finger and let go of the tile (a tap where it last was if no finger is down);
                   the fall is filmed (8 frames over 1.1 s, in one more picture), then time runs on until
                   the next tile is in the hand (at most 2.5 s in all)
  tap <x> [y]      a quick tap at x, y (y 420 if not given); 0.1 s passes (filmed like a lift if it lets go of a tile)
  key <name>       a key press: ArrowLeft ArrowRight ArrowDown Space Enter Escape P M ...; 0.1 s passes
  wait <ms>        let time pass, 1 to 10000 ms
  zoom <picture> <x0> <y0> <x1> <y1>
                   a part of one of your pictures (a game picture, or a quiz sheet once you have the quiz), enlarged;
                   x0 y0 x1 y1 in that picture's own pixels (zoom prints its size); costs nothing
  topics           the topics your write-up should cover
  status           what is left of the budget
  stop             end the background browser of this run folder
x and y are the game's own pixels (the screen is 390 x 844); every picture has rulers in them.
Each op prints the path of its picture. Budget, over all your run folders: 3 runs or 150 lifts, whichever comes first.
Once you have the quiz the game is closed: only zoom, topics and status still work.`;

function rootDir() { return path.resolve(process.env.CLACK_LEARN_ROOT || path.join(path.dirname(REV), 'learners', 'default')); }
function runDir(run) {
  if (run === undefined || run === true || run === '') return null;
  const s = String(run);
  return /[\/\\]/.test(s) ? path.resolve(s) : path.join(rootDir(), 'run-' + s.replace(/[^\w.-]/g, '_'));
}
// the learner's root (the folder holding its run folders) and its state: closed once the quiz is handed out
const rootOf = dir => path.dirname(dir);
const inside = (f, d) => { const r = path.relative(d, f); return r === '' || (!!r && !r.startsWith('..') && !path.isAbsolute(r)); };
function closedOf(root) { const f = path.join(root, '.closed'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
// what the learner's other run folders used: the last audit line of each (lifts and runs are counted per folder)
function usedElsewhere(root, dir) {
  const out = { runs: 0, lifts: 0, folders: [] };
  if (!fs.existsSync(root)) return out;
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const d = path.join(root, e.name);
    if (path.resolve(d) === path.resolve(dir)) continue;
    const a = readLines(path.join(d, '.audit', 'audit.jsonl')).filter(x => typeof x.lifts === 'number');
    if (!a.length) continue;
    const last = a[a.length - 1];
    out.runs += last.runs || 0; out.lifts += last.lifts || 0; out.folders.push(e.name);
  }
  return out;
}
// a root inside the rev5d scratch folder sits beside the quiz's key and the other learners' work: refused
function rootProblem(root) {
  if (inside(root, REV)) return 'the learner root ' + root + ' is inside ' + REV + ' (the quiz key and other learners are there): use an empty folder outside it (CLACK_LEARN_ROOT)';
  return null;
}
const now = () => new Date().toISOString();
const appendLine = (f, o) => { L.mkdirp(path.dirname(f)); fs.appendFileSync(f, JSON.stringify(o) + '\n'); };
const readLines = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

// ---- parsing an op ----
function parseOp(words) {
  const [op, ...rest] = words;
  if (!op) return { err: 'no op given' };
  const o = op.toLowerCase();
  const num = (s, lo, hi, name) => {
    const v = Number(s);
    if (s === undefined || !isFinite(v)) return { err: name + ' must be a number' };
    if (v < lo || v > hi) return { err: name + ' must be from ' + lo + ' to ' + hi };
    return { v };
  };
  if (o === 'start' || o === 'lift' || o === 'status' || o === 'stop' || o === 'topics') return rest.length ? { err: o + ' takes no arguments' } : { op: o, args: [] };
  if (o === 'zoom') {
    if (rest.length !== 5) return { err: 'zoom takes a picture and x0 y0 x1 y1 (its own pixels)' };
    const v = rest.slice(1).map(Number);
    if (!v.every(isFinite) || v[2] <= v[0] || v[3] <= v[1]) return { err: 'zoom: x0 y0 x1 y1 must be numbers with x1 > x0 and y1 > y0' };
    return { op: o, args: [rest[0]].concat(v.map(Math.round)) };
  }
  if (o === 'move' || o === 'tap') {
    const x = num(rest[0], 0, 390, 'x'); if (x.err) return x;
    let y = { v: Y_DEFAULT };
    if (rest.length > 1) { y = num(rest[1], 0, 844, 'y'); if (y.err) return y; }
    if (rest.length > 2) return { err: o + ' takes x and an optional y' };
    return { op: o, args: [Math.round(x.v * 10) / 10, Math.round(y.v * 10) / 10] };
  }
  if (o === 'wait') {
    const t = num(rest[0], 1, 10000, 'ms'); if (t.err) return t;
    if (rest.length > 1) return { err: 'wait takes one number (ms)' };
    return { op: o, args: [Math.round(t.v)] };
  }
  if (o === 'key') {
    if (rest.length !== 1) return { err: 'key takes one key name' };
    const k = KEYS[rest[0].toLowerCase()] || (/^[a-z0-9]$/i.test(rest[0]) ? rest[0].toLowerCase() : null);
    if (!k) return { err: 'unknown key ' + rest[0] + ' (try ArrowLeft, ArrowRight, ArrowDown, Space, Enter, Escape, P, M)' };
    return { op: o, args: [k] };
  }
  return { err: 'unknown op ' + op };
}

// ---- the session: a browser with the game, the op log, the budget ----
class Session {
  constructor(dir) {
    this.dir = dir; this.pngDir = path.join(dir, 'png'); this.auditDir = path.join(dir, '.audit');
    this.opsFile = path.join(dir, 'ops.jsonl'); this.auditFile = path.join(this.auditDir, 'audit.jsonl'); this.sessFile = path.join(this.auditDir, 'session.json');
    L.mkdirp(this.pngDir); L.mkdirp(this.auditDir);
    if (!fs.existsSync(this.sessFile)) {
      // the seed: from the folder's name, so two learners' sessions differ and a session's own replays agree
      const seed = parseInt(crypto.createHash('sha256').update(path.basename(dir)).digest('hex').slice(0, 7), 16) % 900000 + 1000;
      L.writeJSON(this.sessFile, { created: now(), seed, game: L.GAME, limits: LIMITS });
    }
    this.sess = JSON.parse(fs.readFileSync(this.sessFile, 'utf8'));
    this.n = readLines(this.opsFile).length;
    this.root = rootOf(dir);
    this.runs = 0; this.lifts = 0; this.page = null; this.input = null;
  }
  async open() {
    this.browser = await L.launch();
    const pc = await L.phoneContext(this.browser);
    this.context = pc.context; this.errors = pc.errors;
    this.comp = await L.composer(this.browser);
  }
  async close() { if (this.browser) await this.browser.close(); this.browser = null; }
  // replay every op that was carried out, without pictures, checking each against the audit
  async replay(check) {
    const ops = readLines(this.opsFile), audit = readLines(this.auditFile), byN = new Map(audit.map(a => [a.n, a]));
    const diverged = [];
    for (const e of ops) {
      if (!e.ok || e.op === 'zoom') continue;
      const r = await this.apply({ op: e.op, args: e.args }, { replay: true, n: e.n });
      const a = byN.get(e.n);
      if (a && a.digest && r.digest && a.digest !== r.digest) diverged.push(e.n);
      if (check) console.log(String(e.n).padStart(4) + ' ' + (e.op + ' ' + e.args.join(' ')).padEnd(18) + (a && a.digest === r.digest ? ' same' : ' DIFFERS') + '  ' + r.digest);
    }
    return { ops: ops.filter(e => e.ok).length, diverged };
  }
  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  async step(t) { if (t > 0) await this.ev(t => CS.wait(t), t); }
  async state() {
    return this.ev(() => {
      const s = CS.state(), rel = CS.lastRelease;
      return { t: +s.t.toFixed(3), phase: s.phase, ready: s.handReady, piece: s.piece, way: s.way, col: s.col, tiles: s.tiles, landed: s.landed, lost: s.lost,
        bestCm: s.bestCm, height: s.height, box: s.box, fuse: s.fuse, weight: s.weight && { x: +s.weight.x.toFixed(3), zone: s.weight.zone }, W: +s.W.toFixed(3),
        key: CS.rulesKey(), inAir: s.inAir, falling: s.falling, over: s.over, big: s.big, release: rel ? rel.id : 0, evN: CS.events.length };
    });
  }
  digest(st) { return [st.phase, st.tiles, st.landed, st.lost, st.key, st.release, st.t].join('|'); }
  async shotGame() { await this.ev(() => CS.render()); return this.page.screenshot({ type: 'png' }); }
  // one picture: the screen at PNG_SCALE with rulers in game px and the op written above it
  async picture(buf, title, file) {
    const W = 390, H = 844, k = PNG_SCALE, w = Math.round(W * k), h = Math.round(H * k);
    let ticks = '';
    for (let x = 0; x <= W; x += 10) {
      const big = x % 50 === 0;
      ticks += `<div style="position:absolute;left:${(x * k).toFixed(1)}px;top:0;width:1px;height:${big ? 7 : 3}px;background:#1E2541"></div>`;
      if (big) ticks += `<div style="position:absolute;left:${(x * k - 15).toFixed(1)}px;top:7px;width:30px;text-align:center;font-size:9px">${x}</div>`;
    }
    let yt = '';
    for (let y = 0; y <= H; y += 20) {
      const big = y % 100 === 0;
      yt += `<div style="position:absolute;right:0;top:${(y * k).toFixed(1)}px;height:1px;width:${big ? 7 : 3}px;background:#1E2541"></div>`;
      if (big) yt += `<div style="position:absolute;right:8px;top:${(y * k - 6).toFixed(1)}px;font-size:9px">${y}</div>`;
    }
    const html = `<div style="padding:4px 6px 2px;font-size:11px;font-weight:700">${L.esc(title)}</div>
<div style="display:flex"><div style="position:relative;width:30px;height:${h}px">${yt}</div><img src="${L.dataUrl(buf)}" style="width:${w}px;height:${h}px;display:block"></div>
<div style="position:relative;margin-left:30px;width:${w}px;height:20px">${ticks}</div>`;
    fs.writeFileSync(file, await this.comp.shoot(html, '#root{padding:0 4px 2px 0}'));
    return file;
  }
  async filmstrip(frames, title, file) {
    const k = FILM_SCALE, w = Math.round(390 * k), h = Math.round(844 * k);
    const cells = frames.map(f => `<div style="margin:0 4px 6px 0"><div style="font-size:11px;font-weight:700;padding:2px 0">+${f.t.toFixed(2)} s</div><img src="${L.dataUrl(f.buf)}" style="width:${w}px;height:${h}px;display:block;border:1px solid #c9ccd6"></div>`).join('');
    const html = `<div style="padding:4px 6px;font-size:12px;font-weight:700">${L.esc(title)}</div><div style="display:grid;grid-template-columns:repeat(4,${w + 6}px);padding:0 4px">${cells}</div>`;
    fs.writeFileSync(file, await this.comp.shoot(html));
    return file;
  }
  async newPage() {
    if (this.page) { try { await this.page.close(); } catch (e) { /* gone */ } }
    const seed = this.sess.seed + 7919 * this.runs;
    this.page = await this.context.newPage();
    await this.page.goto(L.gameUrl({ drive: 1, seed, mute: 1 }), { waitUntil: 'load' });
    await this.page.waitForFunction(() => typeof CS === 'object' && !!CS.state);
    this.input = await L.touchInput(this.page);
  }
  // after the input of a lift, a tap or a key that let go: the fall filmed, then time passes until it is over
  async filmFall(film) {
    const frames = [];
    let t = 0;
    for (const T of FILM) {
      await this.step(T - t); t = T;
      if (film) frames.push({ t, buf: await this.shotGame() });
    }
    for (;;) {
      const st = await this.ev(() => { const s = CS.state(); return { done: s.phase !== 'play' || (s.handReady && !s.inAir && !s.falling) }; });
      if (st.done || t >= SETTLE_MAX - 1e-9) break;
      await this.step(0.1); t += 0.1;
    }
    return frames;
  }
  // which releases (tiles let go) and new runs the events since index n0 hold
  async since(n0) {
    return this.ev(n0 => CS.events.slice(n0).filter(e => e.type === 'release' || e.type === 'start' || e.type === 'crash' || e.type === 'over' || e.type === 'land' || e.type === 'off' || e.type === 'fuse')
      .map(e => ({ type: e.type, t: e.t, src: e.src, outcome: e.outcome, reason: e.reason, piece: e.piece, way: e.way, col: e.col, mode: e.mode })), n0);
  }
  refuse(o, why) { return { ok: false, refused: why, lines: ['refused: ' + why] }; }
  // the learner's whole budget so far: this folder's and its other run folders' (a new folder is no fresh budget)
  used() { const e = usedElsewhere(this.root, this.dir); return { runs: this.runs + e.runs, lifts: this.lifts + e.lifts, folders: e.folders }; }
  // what the budget allows before an op is carried out (a replay of ops already carried out is not judged again)
  async gate(o, replay) {
    if (replay) return null;
    const cl = closedOf(this.root);
    if (cl) return 'the game is closed: the quiz was handed out (' + cl.at + ')';
    const u = this.used();
    if (u.lifts >= LIMITS.lifts) return 'the session is over: ' + LIMITS.lifts + ' lifts used (over all your run folders)';
    if (o.op === 'start' && u.runs >= LIMITS.runs) return 'no runs left (' + LIMITS.runs + ' used, over all your run folders)';
    if (o.op !== 'start' && !this.page) return 'no game yet: start first';
    if (o.op !== 'start' && o.op !== 'wait' && u.runs >= LIMITS.runs) {
      // (on the title or the results card an input could begin another run)
      const ph = await this.ev(() => CS.state().phase);
      if (ph === 'title' || ph === 'over') return 'no runs left (' + LIMITS.runs + ' used): this run is over';
    }
    return null;
  }
  // carry out one op; returns {ok, lines, files, digest}
  async apply(o, opt) {
    opt = opt || {};
    const n = opt.n || this.n + 1, pics = !opt.replay;
    if (o.op === 'zoom') return this.zoom(o, n);
    const why = await this.gate(o, opt.replay);
    if (why) return this.refuse(o, why);
    const tag = String(n).padStart(4, '0') + '-' + o.op, title = '#' + n + '  ' + o.op + (o.args.length ? ' ' + o.args.join(' ') : '');
    let n0 = this.page ? await this.ev(() => CS.events.length) : 0, rel0 = this.page ? await this.ev(() => CS.lastRelease ? CS.lastRelease.id : 0) : 0;
    let frames = null;
    if (o.op === 'start') {
      await this.newPage(); n0 = 0; rel0 = 0;
      await this.step(0.5);
      const [x, y] = await this.ev(() => [CAM.W / 2, CAM.tapY]);
      await this.input.tap(x, y);
      // the start: the arm shoves the boy's build, the cars roll in; until the first tile is in the hand
      for (let t = 0; t < 12; t += 0.1) { const s = await this.ev(() => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked; }); if (s) break; await this.step(0.1); }
    } else if (o.op === 'move') {
      await this.input.move(o.args[0], o.args[1]); await this.step(MOVE_T);
    } else if (o.op === 'lift') {
      await this.input.lift();
      frames = await this.filmFall(pics);
    } else if (o.op === 'tap' || o.op === 'key') {
      if (o.op === 'tap') await this.input.tap(o.args[0], o.args[1]); else await this.page.keyboard.press(o.args[0]);
      // (a release now, or one queued for the hand: filmed like a lift)
      const let_ = await this.ev(r0 => (CS.lastRelease ? CS.lastRelease.id : 0) !== r0, rel0);
      if (let_) frames = await this.filmFall(pics);
      else {
        await this.step(MOVE_T);
        if (await this.ev(r0 => (CS.lastRelease ? CS.lastRelease.id : 0) !== r0, rel0)) { const more = await this.filmFall(pics); frames = more; }
      }
    } else if (o.op === 'wait') {
      let left = o.args[0] / 1000;
      while (left > 1e-9) { const dt = Math.min(1, left); await this.step(dt); left -= dt; }
    }
    const ev = await this.since(n0), st = await this.state();
    const lets = ev.filter(e => e.type === 'release' && e.src !== 'fuse').length;
    this.lifts += lets;
    this.runs += ev.filter(e => e.type === 'start').length;
    const out = { ok: true, lines: [], files: [], digest: this.digest(st), state: st, events: ev, lets };
    if (pics) {
      const f = await this.picture(await this.shotGame(), title, path.join(this.pngDir, tag + '.png'));
      out.files.push(f); out.lines.push(f);
      if (frames && frames.length) {
        const ff = await this.filmstrip(frames, title + ': the next ' + FILM[FILM.length - 1].toFixed(1) + ' s, ' + frames.length + ' frames', path.join(this.pngDir, tag + '-film.png'));
        out.files.push(ff); out.lines.push(ff);
      }
    }
    const u = this.used();
    out.lines.push('lifts ' + u.lifts + '/' + LIMITS.lifts + ', runs ' + u.runs + '/' + LIMITS.runs + (u.folders.length ? ' (over all your run folders)' : ''));
    return out;
  }
  // zoom: a part of one of the learner's own pictures, enlarged (to about 1100 px across, at most 6 times), with a
  // ruler in the picture's own pixels. Only pictures in the learner's root (not its .audit); nothing is played
  async zoom(o, n) {
    const [pic, x0, y0, x1, y1] = o.args;
    const f = path.resolve(path.isAbsolute(pic) ? pic : fs.existsSync(path.resolve(this.dir, pic)) ? path.resolve(this.dir, pic) : path.resolve(this.root, pic));
    if (!inside(f, this.root) || f.split(path.sep).includes('.audit') || !/\.png$/i.test(f)) return this.refuse(o, 'zoom reads only your own pictures (PNG files in ' + this.root + ')');
    if (!fs.existsSync(f)) return this.refuse(o, 'no such picture: ' + pic);
    const buf = fs.readFileSync(f), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
    const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(W, x1), cy1 = Math.min(H, y1);
    if (cx1 - cx0 < 4 || cy1 - cy0 < 4) return this.refuse(o, `zoom: the part ${x0} ${y0} ${x1} ${y1} is outside the picture (${W} x ${H} px)`);
    const w = cx1 - cx0, h = cy1 - cy0, k = Math.max(1, Math.min(6, 1100 / w, 1400 / h));
    const step = [5, 10, 20, 25, 50, 100, 200].find(s => s * k >= 40) || 200;
    let ticks = '', yt = '';
    for (let x = Math.ceil(cx0 / step) * step; x <= cx1; x += step) ticks += `<div style="position:absolute;left:${((x - cx0) * k).toFixed(1)}px;top:0;width:1px;height:6px;background:#1E2541"></div><div style="position:absolute;left:${((x - cx0) * k - 20).toFixed(1)}px;top:6px;width:40px;text-align:center;font-size:10px">${x}</div>`;
    for (let y = Math.ceil(cy0 / step) * step; y <= cy1; y += step) yt += `<div style="position:absolute;right:0;top:${((y - cy0) * k).toFixed(1)}px;height:1px;width:6px;background:#1E2541"></div><div style="position:absolute;right:8px;top:${((y - cy0) * k - 6).toFixed(1)}px;font-size:10px">${y}</div>`;
    const html = `<div style="padding:4px 6px 2px;font-size:11px;font-weight:700">#${n} zoom ${L.esc(path.relative(this.root, f))} (${W} x ${H} px): x ${cx0}-${cx1}, y ${cy0}-${cy1}, ${k.toFixed(1)} times</div>
<div style="display:flex"><div style="position:relative;width:36px;height:${(h * k).toFixed(0)}px">${yt}</div><div style="width:${(w * k).toFixed(0)}px;height:${(h * k).toFixed(0)}px;overflow:hidden;position:relative">
<img src="${L.dataUrl(buf)}" style="position:absolute;left:${(-cx0 * k).toFixed(1)}px;top:${(-cy0 * k).toFixed(1)}px;width:${(W * k).toFixed(1)}px;height:${(H * k).toFixed(1)}px;max-width:none"></div></div>
<div style="position:relative;margin-left:36px;width:${(w * k).toFixed(0)}px;height:20px">${ticks}</div>`;
    const out = path.join(this.pngDir, String(n).padStart(4, '0') + '-zoom.png');
    fs.writeFileSync(out, await this.comp.shoot(html, '#root{padding:0 4px 2px 0}'));
    return { ok: true, lines: [out, `${path.relative(this.root, f)} is ${W} x ${H} px; shown x ${cx0}-${cx1}, y ${cy0}-${cy1} at ${k.toFixed(1)} times`], files: [out], zoom: true };
  }
  // an op from the command line: carried out, logged and audited
  async run(o) {
    if (o.op === 'status') {
      const u = this.used(), cl = closedOf(this.root);
      return { ok: true, lines: ['lifts ' + u.lifts + '/' + LIMITS.lifts + ', runs ' + u.runs + '/' + LIMITS.runs + ' (over all your run folders)' + (u.lifts >= LIMITS.lifts ? ' (the session is over)' : '') + (cl ? '; the game is closed (the quiz was handed out)' : '')] };
    }
    if (o.op === 'topics') return { ok: true, lines: fs.readFileSync(TOPICS, 'utf8').trimEnd().split('\n') };
    const n = ++this.n, t0 = Date.now();
    let r;
    try { r = await this.apply(o, { n }); } catch (e) { r = { ok: false, error: e.message, lines: ['error: ' + e.message] }; }
    appendLine(this.opsFile, { n, op: o.op, args: o.args, ok: r.ok, at: now(), png: (r.files || []).map(f => path.relative(this.dir, f)), refused: r.refused || undefined, error: r.error || undefined });
    appendLine(this.auditFile, { n, op: o.op, args: o.args, ok: r.ok, refused: r.refused || null, error: r.error || null, ms: Date.now() - t0, lifts: this.lifts, runs: this.runs,
      digest: r.digest || null, state: r.state || null, events: r.events || null, consoleErrors: (this.errors || []).splice(0) });
    return r;
  }
}

// ---- the background browser: one per run folder, on a local port ----
async function serve(dir) {
  const S = new Session(dir);
  const log = (...a) => fs.appendFileSync(path.join(S.auditDir, 'daemon.log'), now() + ' ' + a.join(' ') + '\n');
  await S.open();
  const rp = await S.replay(false);
  log('replayed ' + rp.ops + ' ops' + (rp.diverged.length ? '; DIVERGED at ' + rp.diverged.join(',') : ''));
  let warn = rp.diverged.length ? 'warning: the session was restored from its log and differs from the original at op ' + rp.diverged[0] : null;
  let idle = null, queue = Promise.resolve();
  const bump = () => { if (idle) clearTimeout(idle); idle = setTimeout(async () => { log('idle: exit'); await S.close(); process.exit(0); }, IDLE_MS); };
  const server = net.createServer(sock => {
    let buf = '';
    sock.on('data', d => {
      buf += d;
      const i = buf.indexOf('\n');
      if (i < 0) return;
      const req = JSON.parse(buf.slice(0, i)); buf = '';
      queue = queue.then(async () => {
        bump();
        if (req.op === 'stop') { sock.end(JSON.stringify({ ok: true, lines: ['stopped'] }) + '\n'); log('stop'); await S.close(); process.exit(0); }
        const r = await S.run(req);
        if (warn) { r.lines.unshift(warn); warn = null; }
        sock.end(JSON.stringify({ ok: r.ok, lines: r.lines }) + '\n');
      }).catch(e => { log('error ' + e.stack); try { sock.end(JSON.stringify({ ok: false, lines: ['error: ' + e.message] }) + '\n'); } catch (x) { /* gone */ } });
    });
  });
  server.listen(0, '127.0.0.1', () => {
    L.writeJSON(path.join(S.auditDir, 'daemon.json'), { pid: process.pid, port: server.address().port, started: now() });
    log('listening on ' + server.address().port);
    bump();
  });
}
function ask(port, req) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1');
    let buf = '';
    sock.on('connect', () => sock.write(JSON.stringify(req) + '\n'));
    sock.on('data', d => { buf += d; });
    sock.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('bad answer from the session')); } });
    sock.on('error', reject);
  });
}
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
async function viaDaemon(dir, req) {
  const auditDir = path.join(dir, '.audit'), df = path.join(auditDir, 'daemon.json');
  L.mkdirp(auditDir);
  const tryAsk = async () => {
    if (!fs.existsSync(df)) return null;
    const d = JSON.parse(fs.readFileSync(df, 'utf8'));
    if (!alive(d.pid)) return null;
    try { return await ask(d.port, req); } catch (e) { return null; }
  };
  let r = await tryAsk();
  if (r) return r;
  if (req.op === 'stop') return { ok: true, lines: ['no session browser running'] };
  // start one (a lock keeps two callers from starting two)
  const lock = path.join(auditDir, 'spawn.lock');
  try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); }
  catch (e) { if (Date.now() - fs.statSync(lock).mtimeMs > 180000) { fs.unlinkSync(lock); return viaDaemon(dir, req); } }
  try {
    if (fs.existsSync(df)) fs.unlinkSync(df);
    const out = fs.openSync(path.join(auditDir, 'daemon.log'), 'a');
    const child = spawn(process.execPath, [__filename, '--serve', '--run=' + dir], { detached: true, stdio: ['ignore', out, out] });
    child.unref();
    for (let i = 0; i < 1200; i++) {
      await new Promise(res => setTimeout(res, 250));
      if (!alive(child.pid)) break;
      r = await tryAsk();
      if (r) return r;
    }
  } finally { try { fs.unlinkSync(lock); } catch (e) { /* gone */ } }
  return null;
}
async function direct(dir, req) {
  const S = new Session(dir);
  await S.open();
  try {
    const rp = await S.replay(false);
    const r = await S.run(req);
    if (rp.diverged.length) r.lines.unshift('warning: the session was restored from its log and differs from the original at op ' + rp.diverged[0]);
    return r;
  } finally { await S.close(); }
}

// ---- the graders' views ----
function printAudit(dir) {
  const rows = readLines(path.join(dir, '.audit', 'audit.jsonl'));
  let lets = 0, fits = 0, offs = 0, crashes = 0;
  for (const a of rows) {
    const ev = (a.events || []);
    const rel = ev.filter(e => e.type === 'release').map(e => (e.src === 'fuse' ? 'FUSE ' : '') + (e.piece === 'sq' ? '■' : e.way === 'down' ? '▼' : '▲') + (e.col / 2) + ' ' + (e.outcome === 'fit' ? 'fit' : 'OFF ' + e.reason)).join('; ');
    lets += ev.filter(e => e.type === 'release').length; fits += ev.filter(e => e.type === 'release' && e.outcome === 'fit').length;
    offs += ev.filter(e => e.type === 'release' && e.outcome !== 'fit').length; crashes += ev.filter(e => e.type === 'crash').length;
    const st = a.state;
    console.log(String(a.n).padStart(4) + ' ' + (a.op + ' ' + (a.args || []).join(' ')).padEnd(16) + (a.ok ? '' : ' REFUSED ' + (a.refused || a.error)) +
      (st ? ` ${st.phase} t${st.t} tiles ${st.tiles} lost ${st.lost} ${st.height}cm` : '') + (rel ? '  | ' + rel : '') + (ev.some(e => e.type === 'crash') ? '  | CRASH' : '') +
      ((a.consoleErrors || []).length ? '  | console errors: ' + a.consoleErrors.join(' / ') : ''));
  }
  const last = rows[rows.length - 1];
  console.log(`${rows.length} ops; ${lets} tiles let go (${fits} fit, ${offs} fell off); ${crashes} crashes; budget used: lifts ${last ? last.lifts : 0}/${LIMITS.lifts}, runs ${last ? last.runs : 0}/${LIMITS.runs}`);
}

async function main() {
  const a = L.args();
  if (a.help || a.h) { console.log(USAGE); return 0; }
  const dir = runDir(a.run);
  if (!dir) { console.log(USAGE); return 2; }
  if (a.serve) { await serve(dir); return null; }
  if (a.audit) { printAudit(dir); return 0; }
  if (a.replay) {
    const S = new Session(dir);
    await S.open();
    try { const r = await S.replay(true); console.log(r.diverged.length ? 'DIVERGED at ' + r.diverged.join(', ') : 'all ' + r.ops + ' ops replay the same'); return r.diverged.length ? 1 : 0; }
    finally { await S.close(); }
  }
  const o = parseOp(a._);
  if (o.err) { console.log('error: ' + o.err + '\n' + USAGE); return 2; }
  const bad = rootProblem(rootOf(dir));
  if (bad) { console.log('refused: ' + bad); return 1; }
  if (o.op === 'topics') { console.log(fs.readFileSync(TOPICS, 'utf8').trimEnd()); return 0; }
  let r = a.direct ? null : await viaDaemon(dir, o);
  if (!r) r = await direct(dir, o);
  for (const l of r.lines) console.log(l);
  return r.ok ? 0 : 1;
}
if (require.main === module) main().then(c => { if (c !== null) process.exit(c); }, e => { console.error(e); process.exit(1); });
module.exports = { Session, parseOp, runDir, rootOf, closedOf, usedElsewhere, rootProblem, LIMITS, REV };
