// ACCESSION — policy plumbing (BUILD.md §10.2): what a policy sees (Obs.make), the helpers
// it may use on what it sees, and the registry of policies (Policies). A classic script,
// loaded with every policy file into the hardened core context (tools/core-context.js), where
// Math holds only the integer functions and the clock throws; lint-core checks this folder as
// it checks the core (§3.3).
//
// A POLICY sees only what a player sees (§10.2; the plan's D7.7):
//   obs = { vm, read(target), legal, rng, log }
//     vm      ViewModel.derive(state, {events}): the board as drawn, with the last step's
//             events, so its noise rings and one-turn cues are there; a frozen copy (its
//             typed arrays as plain lists), so nothing a policy does to it reaches the game;
//     read    read(target) → the label's text as the panel shows it, or null for something
//             not in view; target is an exhibit's uid, 'case:x,y', 'item:<uid>',
//             'plaque:x,y', 'staff:x,y' or 'you'. Each read is logged;
//     legal   Step.legal(state): the buttons a player has (a frozen copy too);
//     rng     a stream on the policy's own holder, policy/<name>/<seed> (never in the state):
//             the only source of a policy's choices;
//     log     the log's sentences for the last step (Text.log), as a player reads them.
// It answers decide(obs) → {action, reason}: an action from obs.legal, and one line saying
// why, in words ("attacks A4.2.room.1 beside you, 10 HP left"), which the sim logs (§10.2).
//
// A POLICY FILE (tools/policies/<id>.js) registers a group of policies:
//   Policies.add('<id>', { naive: {card, decide(obs)}, counter: {card, decide(obs)} })
// card = { summary: one sentence, rules: [its rules, in the order it applies them],
//          weights: [[name, value]…] (optional) }, printed in tools/policies/README.md and in
// every report; a policy may also carry kit ({weapon: {form, tier, level}, garment: {…}}),
// the kit an arena gives it (§10.3's splitter: Light against Heavy).
'use strict';
const Obs = (() => {
  const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

  // A label as the text a reader sees, field by field in the panel's order (§8.8): title,
  // number, state, tombstone, pictograms, Behaviour line, odds, paragraph or "Come closer",
  // actions; then any other words a label adds. Icons are named by their id.
  const ORDER = ['title', 'number', 'num', 'stateIcons', 'state', 'tomb', 'pictos', 'behaviour', 'odds', 'lines', 'paragraph', 'far', 'text', 'actions'];
  const SKIP = ['uid', 'closeup', 'sprite', 'id', 'x', 'y', 'icon', 'kind'];
  function text(label) {
    if (label === null || label === undefined) return null;
    if (typeof label === 'string') return label;
    const out = [];
    const add = v => {
      if (v === null || v === undefined || v === '') return;
      if (typeof v === 'string') out.push(v);
      else if (typeof v === 'number' || typeof v === 'boolean') out.push(String(v));
      else if (Array.isArray(v)) { for (const x of v) add(x); }
      else if (typeof v === 'object') {
        if (typeof v.icon === 'string' && typeof v.text === 'string') { out.push(v.icon + ' ' + v.text); return; }
        if (typeof v.text === 'string') { out.push(v.text); return; }
        // Object.keys gives a record's own keys in the order it was written, on every engine.
        for (const k of Object.keys(v)) if (!SKIP.includes(k)) add(v[k]);
      }
    };
    for (const k of ORDER) if (Object.prototype.hasOwnProperty.call(label, k)) add(label[k]);
    for (const k of Object.keys(label)) if (!ORDER.includes(k) && !SKIP.includes(k)) add(label[k]);
    return out.join('\n');
  }

  const visibleIn = (vm, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < vm.w && y < vm.h && vm.vis[y * vm.w + x] === 2;

  // The text of what a reader may read now, or null (§8.8: anything visible may be examined;
  // the paragraph needs you within READ_RANGE, which the label itself applies).
  function readLabel(state, vm, target) {
    if (typeof target !== 'string' || !target) return null;
    if (target === 'you') return text(Labels.you(state));
    let m = /^(case|plaque|staff):(\d+),(\d+)$/.exec(target);
    if (m) {
      const x = Number(m[2]), y = Number(m[3]);
      if (!visibleIn(vm, x, y)) return null;
      const f = Cases.at(state, x, y);
      if (!f || f.k !== m[1]) return null;
      return text(m[1] === 'case' ? Labels.ofCase(state, f) : m[1] === 'plaque' ? Labels.ofPlaque(state, f) : Labels.ofStaffDoor(state, f));
    }
    m = /^item:(.+)$/.exec(target);
    if (m) {
      const it = (state.items || []).find(i => i.uid === m[1]);
      if (!it) return null;
      const w = it.where, shown = w.at === 'tote' || w.at === 'kit' || ((w.at === 'floor' || w.at === 'case') && visibleIn(vm, w.x, w.y));
      return shown ? text(Labels.ofItem(state, it.uid)) : null;
    }
    if (!vm.actors.some(a => a.uid === target && a.uid !== 'you')) return null;
    return text(Labels.of(state, target));
  }

  // A deep copy that shares nothing with what it copies, typed arrays (the view model's vis
  // and ring) made plain lists, every part frozen: what a policy is handed is its own, and
  // a write into it fails at once instead of reaching the game state (the view model hands
  // out the state's own tiles array and over record).
  function own(v) {
    if (v === null || typeof v !== 'object') return v;
    if (ArrayBuffer.isView(v)) return Object.freeze(Array.from(v));
    if (Array.isArray(v)) return Object.freeze(v.map(own));
    const out = {};
    // Object.keys gives a record's own keys in the order it was written, on every engine.
    for (const k of Object.keys(v)) out[k] = own(v[k]);
    return Object.freeze(out);
  }

  // What a policy sees now (above). events: the last step's (none before the first);
  // readLog: a list each read is appended to, as {turn, target, text}; rng: the policy's
  // stream (Rng.stream on the policy's own holder).
  function make(state, events, readLog, rng) {
    const ev = events || [];
    const drawn = ViewModel.derive(state, { events: ev });
    const shown = drawn.actors.map(a => a.uid);
    const log = Object.freeze(Text.log(ev, Labels.nameOf(state), uid => shown.includes(uid)));
    const read = target => {
      const t = readLabel(state, drawn, target);
      if (readLog) readLog.push({ turn: state.turn, target: String(target), text: t });
      return t;
    };
    return { vm: own(drawn), read, legal: own(Step.legal(state)), rng: rng || null, log };
  }

  // HELPERS, on what the policy sees (the view model and its legal actions) and nothing else.
  // you(vm): your entry in vm.actors (always first).
  const you = vm => vm.actors.find(a => a.uid === 'you') || null;
  // Chebyshev distance from (x, y) to the nearest tile of an actor's footprint (§4.1).
  function dist(a, x, y) {
    const s = a.size || 1, nx = Math.min(Math.max(x, a.x), a.x + s - 1), ny = Math.min(Math.max(y, a.y), a.y + s - 1);
    return Math.max(Math.abs(nx - x), Math.abs(ny - y));
  }
  // The hostile actors in view, nearest you first, then by uid.
  function hostiles(vm) {
    const me = you(vm);
    return vm.actors.filter(a => a.hostile && a.uid !== 'you')
      .sort((a, b) => (dist(a, me.x, me.y) - dist(b, me.x, me.y)) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  }
  // The board as Path and Grid read it, from what the view model shows: its tiles (unseen
  // ones are not walkable), the actors in view, the staff doors it shows with their grades
  // (vm.staff, the plan's A14: [{x, y, grade, open}]; none until the view model lists
  // them) as staff fixtures, and your grade as run.grade, so Path.to goes through a closed
  // staff door just where it would for the tap (§8.3: only within your grade). No surfaces,
  // which the view model draws but does not hand to Grid.
  const staffOf = vm => (vm.staff || []).map(f => ({ k: 'staff', x: f.x, y: f.y, grade: f.grade }));
  const board = vm => ({ dept: { w: vm.w, h: vm.h, tiles: vm.tiles, fixtures: staffOf(vm) }, actors: vm.actors, run: { grade: vm.you.grade } });
  // path(vm, x, y) → [[x, y]…]: the way a tap on (x, y) would walk you (Path.to, the player's
  // own rule), over the tiles shown, round the actors in view, and through a staff door only
  // where your grade opens it; [] if there is none.
  const path = (vm, x, y) => Path.to(board(vm), x, y);
  // The legal action that is exactly this one, or null.
  const same = (a, b) => State.canon(a) === State.canon(b);
  const legalAs = (obs, action) => obs.legal.find(l => same(l, action)) || null;
  const legalOf = (obs, k) => obs.legal.filter(l => l.a === k);
  // step(obs, x, y) → the legal move that takes the first step of path(vm, x, y), or null.
  function step(obs, x, y) {
    const p = path(obs.vm, x, y), me = you(obs.vm);
    if (!p.length) return null;
    const d = Path.dirTo([me.x, me.y], p[0]);
    return d < 0 ? null : legalAs(obs, { a: 'move', dir: d });
  }
  // attack(obs, uid) → the legal attack on uid, or null.
  const attack = (obs, uid) => legalAs(obs, { a: 'attack', uid });
  // away(obs, x, y) → the legal step onto an empty, open tile that most increases your
  // Chebyshev distance from (x, y), ties in direction order; null if none increases it.
  function away(obs, x, y) {
    const vm = obs.vm, me = you(vm), m = board(vm).dept, here = Math.max(Math.abs(me.x - x), Math.abs(me.y - y));
    let best = null, bestD = here;
    for (const l of legalOf(obs, 'move')) {
      const nx = me.x + Grid.DX[l.dir], ny = me.y + Grid.DY[l.dir], ch = Grid.ch(m, nx, ny);
      if (ch === '+' || ch === 'S' || vm.actors.some(a => a.uid !== 'you' && dist(a, nx, ny) === 0)) continue;
      const d = Math.max(Math.abs(nx - x), Math.abs(ny - y));
      if (d > bestD) { best = l; bestD = d; }
    }
    return best;
  }
  // inLine(a, b, range?) → do a and b (actors or {x, y}) share a row or a column, any tile
  // of their footprints, within range tiles (Chebyshev) if range is given?
  function inLine(a, b, range) {
    const sa = a.size || 1, sb = b.size || 1;
    const rows = a.y <= b.y + sb - 1 && b.y <= a.y + sa - 1, cols = a.x <= b.x + sb - 1 && b.x <= a.x + sa - 1;
    if (!rows && !cols) return false;
    if (range === undefined) return true;
    const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + sa - 1, b.x + sb - 1)), dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + sa - 1, b.y + sb - 1));
    return Math.max(dx, dy) <= range;
  }
  // marked(vm, x, y) → the damage the pending telegraph marks on (x, y) would deal you (0
  // where there are none); calls marks deal no damage and count 0.
  function marked(vm, x, y) {
    let d = 0;
    for (const mk of vm.marks || []) if (mk.kind === 'telegraph' && mk.x === x && mk.y === y && Number.isInteger(mk.dmg)) d += mk.dmg;
    return d;
  }
  // say(action) → the action in words, for reasons: 'wait', 'move north', 'attack <uid>', …
  function say(action) {
    if (!action || typeof action.a !== 'string') return 'nothing';
    if (action.a === 'move') return 'move ' + (DIRS[action.dir] || 'nowhere');
    const bits = [action.a];
    if (action.uid !== undefined) bits.push(String(action.uid));
    if (action.x !== undefined && action.y !== undefined) bits.push(`at ${action.x},${action.y}`);
    if (action.on !== undefined) bits.push('on ' + action.on);
    if (action.slot !== undefined) bits.push(String(action.slot));
    if (action.i !== undefined) bits.push('#' + action.i);
    return bits.join(' ');
  }

  return { make, own, text, readLabel, you, dist, hostiles, board, path, step, attack, away, inLine, marked, legalOf, legalAs, same, say, DIRS };
})();

const Policies = (() => {
  const groups = [];
  const ID = /^[a-z0-9_]+$/;
  const clean = s => typeof s === 'string' && s.trim() !== '' && !/undefined|NaN|\[object/.test(s);

  // A card's problem in words, or null: a summary sentence, its rules in order, and its
  // weights as [name, value] pairs (§10.2).
  function checkCard(card) {
    if (!card || typeof card !== 'object') return 'has no card';
    if (!clean(card.summary)) return 'needs a card summary: one sentence saying what it does';
    if (!Array.isArray(card.rules) || !card.rules.length || !card.rules.every(clean)) return 'needs card rules: a list of its rules in order, in words';
    if (card.weights !== undefined && !(Array.isArray(card.weights) && card.weights.every(w => Array.isArray(w) && w.length === 2 && clean(w[0]) && (Number.isInteger(w[1]) || clean(w[1])))))
      return 'has card weights that are not [name, value] pairs (a whole number or words)';
    return null;
  }
  function check(name, p) {
    if (!p || typeof p !== 'object') return `${name} is not a policy`;
    const c = checkCard(p.card);
    if (c) return `${name} ${c}`;
    if (typeof p.decide !== 'function') return `${name} needs decide(obs) → {action, reason}`;
    if (p.kit !== undefined) {
      if (!p.kit || typeof p.kit !== 'object') return `${name}'s kit is {weapon?, garment?}`;
      for (const k of Object.keys(p.kit)) if (k !== 'weapon' && k !== 'garment') return `${name}'s kit may change only the weapon and garment you start with, not ${k}`;
    }
    return null;
  }

  // add(id, set): a group of policies, set = {name: policy, …}, each name used once.
  function add(id, set) {
    if (typeof id !== 'string' || !ID.test(id)) throw new Error(`Policies.add: a group id is lower-case letters, digits and _, not ${id}`);
    if (groups.some(g => g.id === id)) throw new Error(`Policies.add: the group ${id} is added twice`);
    if (!set || typeof set !== 'object') throw new Error(`Policies.add: ${id} needs its policies, {name: policy}`);
    const names = Object.keys(set);
    if (!names.length) throw new Error(`Policies.add: ${id} has no policies`);
    for (const n of names) {
      if (!ID.test(n)) throw new Error(`Policies.add: ${id}.${n}: a policy name is lower-case letters, digits and _`);
      const bad = check(`${id}.${n}`, set[n]);
      if (bad) throw new Error('Policies.add: ' + bad);
    }
    groups.push({ id, names, set });
  }

  // get(ref, group?) → {name, group, policy} or null. ref is '<group>.<name>', or a name
  // looked up in `group`, then in the basic group, or a group with one policy.
  function get(ref, group) {
    if (typeof ref !== 'string' || !ref) return null;
    const find = (g, n) => { const G = groups.find(x => x.id === g); return G && G.names.includes(n) ? { name: `${g}.${n}`, group: g, policy: G.set[n] } : null; };
    const dot = ref.indexOf('.');
    if (dot > 0) return find(ref.slice(0, dot), ref.slice(dot + 1));
    if (group) { const r = find(group, ref); if (r) return r; }
    const b = find('basic', ref);
    if (b) return b;
    const G = groups.find(x => x.id === ref);
    return G && G.names.length === 1 ? find(ref, G.names[0]) : null;
  }
  // Every policy, in the order the groups were added and their policies written.
  function list() {
    const out = [];
    for (const g of groups) for (const n of g.names) out.push({ name: `${g.id}.${n}`, group: g.id, policy: g.set[n] });
    return out;
  }
  const groupIds = () => groups.map(g => g.id);

  return { add, get, list, groupIds, check, checkCard };
})();

// The basic group: the plumbing's own policies, for the tools' tests and as baselines.
Policies.add('basic', {
  idle: {
    card: { summary: 'Waits every turn; it shows what the room does to someone who does nothing.', rules: ['Wait.'] },
    decide: obs => ({ action: { a: 'wait' }, reason: 'waits' }),
  },
  random: {
    card: { summary: 'Picks one of the legal actions at random each turn, as the monkey does.', rules: ['Pick a legal action, every one equally likely, on its own stream.'] },
    decide(obs) {
      const action = obs.rng.pick(obs.legal);
      return { action, reason: `picks ${Obs.say(action)} at random from ${obs.legal.length} legal actions` };
    },
  },
  fighter: {
    card: {
      summary: 'Fights the exhibits in view: strikes one when it can, the weakest first, and otherwise walks toward the nearest.',
      rules: ['If an exhibit in view can be struck, strike the one with the least health (then the nearest, then by uid).',
        'Otherwise, if an exhibit is in view, take the first step of the way a tap on it would walk.',
        'Otherwise, wait.'],
    },
    decide(obs) {
      const vm = obs.vm, me = Obs.you(vm), foes = Obs.hostiles(vm);
      const strikable = foes.filter(f => Obs.attack(obs, f.uid))
        .sort((a, b) => (a.hp - b.hp) || (Obs.dist(a, me.x, me.y) - Obs.dist(b, me.x, me.y)) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
      if (strikable.length) { const f = strikable[0]; return { action: Obs.attack(obs, f.uid), reason: `attacks ${f.uid}, which has ${f.hp} HP` }; }
      for (const f of foes) {
        const s = Obs.step(obs, f.x, f.y);
        if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} toward ${f.uid}, ${Obs.dist(f, me.x, me.y)} tiles away` };
      }
      return { action: { a: 'wait' }, reason: foes.length ? 'waits: no way toward an exhibit in view' : 'waits: no exhibit in view' };
    },
  },
});
