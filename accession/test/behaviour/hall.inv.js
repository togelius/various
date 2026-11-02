// The Centrepiece hall's seal (BUILD.md §8.4, §4.1; M4 plan A13, D3.1), as invariants checked
// after every step. Each is written from the rule's sentences, not from rules/hall.js:
//   hall.shutters  a shutter (Z) stands on a tile only while the hall is sealed, and then on
//                  every one of its openings and nowhere else; a tile becomes a shutter only
//                  as the hall seals, and stops being one only as it opens, when it is again
//                  the tile it was (an opening's ch);
//   hall.paused    with a clock, the hall is sealed exactly while the clock's count is paused
//                  (pausedSince), which is the turn it sealed;
//   hall.clear     no one ever stands on a shutter;
//   hall.seal      the shutters close only at a turn boundary while you stand inside the hall,
//                  every opening is clear and the Centrepiece stands; a fight's, only while
//                  one of its pieces hunts you from inside the hall (the cause names it);
//   hall.frozen    while the hall stays sealed through a step, the clock's count does not move,
//                  you do not regenerate, and no clock stage, night-watch bell or Night
//                  Watchman comes;
//   hall.waiting   the hall says it waits (stage waiting) at most once while one wait lasts,
//                  only while you stand inside it; its cause's by, if any, is what calls for
//                  the seal (a fight's: one of its pieces, hunting you, in the hall), never
//                  merely who stands in the way; it names who stands in an opening (in) only
//                  if that one does and you see it, and names one whenever you see one there;
//   hall.alone     the shutters stay down only while a piece of the Centrepiece stands in the
//                  hall (a step may end sealed with none there only when one of its pieces
//                  fell in it, and the next boundary opens them), and they open as alone only
//                  once every piece that stood in the hall has fallen;
//   hall.quiet     the shutters open as quiet only once SEAL_LIFT_TURNS turns have passed since
//                  the seal, and never while a piece stands beside you.
'use strict';
module.exports = (C) => {
  const { N, Grid, Actors } = C;
  const cpOf = s => (s && s.dept && s.dept.cp) || null;
  const of = (ev, stage) => ev.filter(e => e.k === 'stage' && e.cause && e.cause.k === 'hall' && e.stage === stage);
  const key = (x, y) => x + ',' + y;
  // The tiles that are shutters in a state, as a Set of "x,y".
  function shutters(s) {
    const out = new Set(), t = s.dept.tiles;
    for (let y = 0; y < t.length; y++) {
      let x = t[y].indexOf('Z');
      while (x >= 0) { out.add(key(x, y)); x = t[y].indexOf('Z', x + 1); }
    }
    return out;
  }
  const anyZ = s => s.dept.tiles.some(r => r.indexOf('Z') >= 0);
  // An exhibit's mode just before event i of the step: its mode before the step, then each
  // change its events tell (§3.4: woke, hunting, lost, alerted, returned).
  function modeAt(pre, events, uid, i) {
    const a = pre.actors.find(x => x.uid === uid);
    let mode = a ? a.mode : null;
    for (let k = 0; k < i; k++) {
      const e = events[k];
      if (e.who !== uid) continue;
      if (e.k === 'woke') mode = e.mode;
      else if (e.k === 'hunting') mode = 'hunting';
      else if (e.k === 'lost') mode = e.to;
      else if (e.k === 'alerted') mode = 'awake';
      else if (e.k === 'returned') mode = e.phase === 'arrived' ? 'reinstalling' : 'dormant';
    }
    return mode;
  }
  const inHall = (s, x, y) => {
    const c = cpOf(s), m = s.dept;
    const r = c && (m.rooms || []).find(q => q.key === c.room || q.id === c.room);
    return !!r && Array.isArray(m.roomOf) && !!m.roomOf[y] && m.roomOf[y][x] === r.id;
  };
  // An actor with any tile of it in the hall.
  const bodyIn = (s, a) => Actors.footprint(a).some(([x, y]) => inHall(s, x, y));
  const piecesUp = s => { const c = cpOf(s); return ((c && c.uids) || []).map(u => s.actors.find(a => a.uid === u)).filter(a => a && !a.gone); };
  // Do you see actor a in state s, as the board shows it: a tile of it in your sight, and it
  // shown as itself (a mimic in its disguise shows as a case)?
  function seen(s, a) {
    if (!a || a.gone || C.Archetypes.present(s, a) !== null) return false;
    const v = C.Vision.visible(s), m = s.dept;
    return Actors.footprint(a).some(([x, y]) => Grid.inside(m, x, y) && v[y * m.w + x] === 1);
  }
  // Did anything after event i of the step move actor uid or change a door (so what stood or
  // was in sight then may differ from the step's end)?
  const changedAfter = (events, i, uid) => events.slice(i + 1).some(e => (e.k === 'moved' && (uid === null || e.who === uid)) || e.k === 'opened' || e.k === 'closed');

  return [
    {
      id: 'hall.shutters',
      check(pre, events, post) {
        const c = cpOf(post), was = cpOf(pre);
        if (!c) {
          if (!anyZ(pre) && !anyZ(post)) return null;
          const a = shutters(pre), b = shutters(post);
          for (const k of b) if (!a.has(k)) return `a shutter came down at ${k} with no Centrepiece hall`;
          for (const k of a) if (!b.has(k)) return `a shutter at ${k} opened with no Centrepiece hall`;
          return null;
        }
        const open = new Set((c.openings || []).map(o => key(o.x, o.y))), z = shutters(post);
        for (const k of z) if (!open.has(k)) return `a shutter stands at ${k}, which is none of the hall's openings`;
        for (const o of c.openings || []) {
          const ch = post.dept.tiles[o.y][o.x];
          if (c.sealed && ch !== 'Z') return `the hall is sealed, but its opening at ${key(o.x, o.y)} is ${JSON.stringify(ch)}, not a shutter`;
          if (!c.sealed && ch === 'Z') return `the hall is not sealed, but a shutter stands over its opening at ${key(o.x, o.y)}`;
        }
        // A tile becomes a shutter as the hall seals, keeping what it was; it is that again as it opens.
        // What it was is the tile as the hall sealed, at the step's boundary: shards that fell on
        // an opening (floor or archway, §8.3) earlier in that step, a glass body falling there or
        // a case breaking beside it, are kept under the shutter (M4 FU3: M.11 seed 8 at depth 6,
        // the Board's core planted ready).
        const sealedNow = of(events, 'sealed').length > 0, opened = of(events, 'unsealed').length > 0;
        const list = c.openings || [];
        for (let i = 0; i < list.length; i++) {
          const o = list[i], p = pre.dept.tiles[o.y][o.x], q = post.dept.tiles[o.y][o.x], at = key(o.x, o.y);
          const kept = was && Array.isArray(was.openings) && was.openings[i] ? was.openings[i].ch : null;
          if (p !== 'Z' && q === 'Z' && !sealedNow) return `the opening at ${at} became a shutter with no seal`;
          if (p !== 'Z' && q === 'Z' && o.ch !== p && !(o.ch === 'x' && (p === '.' || p === ','))) return `the opening at ${at} was ${JSON.stringify(p)}, but its shutter keeps ${JSON.stringify(o.ch)}`;
          if (p === 'Z' && q !== 'Z' && !opened) return `the shutter at ${at} opened with no unsealing`;
          if (p === 'Z' && q !== 'Z' && q !== kept) return `the shutter at ${at} opened onto ${JSON.stringify(q)}, not the ${JSON.stringify(kept)} it closed over`;
        }
        return null;
      },
    },
    {
      id: 'hall.paused',
      check(pre, events, post) {
        const c = cpOf(post), k = post.dept.clock;
        if (!k) return null;
        const paused = k.pausedSince !== null && k.pausedSince !== undefined;
        if (!c) return paused ? `the clock is paused (since ${k.pausedSince}) with no Centrepiece hall` : null;
        if (!!c.sealed !== paused) return c.sealed ? `the hall is sealed but the clock is not paused` : `the clock is paused since ${k.pausedSince} but the hall is not sealed`;
        if (c.sealed && k.pausedSince !== c.sealed.turn) return `the clock is paused since ${k.pausedSince}, but the hall sealed at turn ${c.sealed.turn}`;
        return null;
      },
    },
    {
      id: 'hall.clear',
      check(pre, events, post) {
        if (!anyZ(post)) return null;
        for (const a of post.actors) {
          if (a.gone) continue;
          for (const [x, y] of Actors.footprint(a)) if (Grid.ch(post.dept, x, y) === 'Z') return `${a.uid} stands on a shutter at ${key(x, y)}`;
        }
        return null;
      },
    },
    {
      id: 'hall.seal',
      check(pre, events, post) {
        const sealed = of(events, 'sealed');
        if (!sealed.length) return null;
        const c = cpOf(post), you = post.actors[0];
        if (sealed.length > 1) return `the hall sealed ${sealed.length} times in one step`;
        if (!c || !c.sealed) return 'the hall said it sealed, but it is not sealed';
        const e = sealed[0];
        if (e.tick !== e.turn * N.TICKS_PER_TURN) return `the hall sealed at tick ${e.tick}, not at a turn boundary`;
        if (!inHall(post, you.x, you.y)) return `the hall sealed while you stood at ${key(you.x, you.y)}, outside it`;
        const pieces = (c.uids || []).map(u => post.actors.find(a => a.uid === u)).filter(a => a && !a.gone);
        if (!pieces.length) return 'the hall sealed with none of its Centrepiece standing';
        if (c.form === 'fight') {
          if (e.cause.why !== 'hunt' || !(c.uids || []).includes(e.cause.by)) return `a fight's hall sealed for ${JSON.stringify(e.cause)}, not for one of its pieces hunting you`;
          const mode = modeAt(pre, events, e.cause.by, events.indexOf(e));
          if (mode !== 'hunting') return `the hall sealed for ${e.cause.by}, which was ${mode}, not hunting you`;
          const p = post.actors.find(a => a.uid === e.cause.by);
          if (!p || !bodyIn(post, p)) return `the hall sealed for ${e.cause.by}, which hunts you from outside it: you are sealed in alone`;
        }
        return null;
      },
    },
    {
      id: 'hall.frozen',
      check(pre, events, post) {
        const a = cpOf(pre), b = cpOf(post);
        if (!a || !b || !a.sealed || !b.sealed || a.sealed.turn !== b.sealed.turn || of(events, 'unsealed').length) return null;
        const k0 = pre.dept.clock, k1 = post.dept.clock;
        if (k0 && k1 && k0.count !== k1.count) return `the clock's count moved from ${k0.count} to ${k1.count} while the hall was sealed`;
        const e = events.find(f => f.k === 'regenerated' || (f.k === 'stage' && f.cause && f.cause.k === 'clock') || (f.k === 'entered' && f.cause && f.cause.k === 'night_watch'));
        return e ? `while the hall was sealed: ${e.k}${e.stage ? ' ' + e.stage : ''}` : null;
      },
    },
    {
      id: 'hall.waiting',
      check(pre, events, post) {
        const w = of(events, 'waiting');
        if (!w.length) return null;
        if (w.length > 1) return `the hall said ${w.length} times in one step that it waits`;
        const a = cpOf(pre), b = cpOf(post), you = post.actors[0];
        if (a && a.waiting && b && b.waiting && a.waiting.turn === b.waiting.turn) return 'the hall said again that it waits, in the same wait';
        if (!inHall(post, you.x, you.y)) return 'the hall said it waits while you stood outside it';
        const e = w[0], i = events.indexOf(e), by = e.cause.by, inn = e.cause.in;
        if (by !== undefined) {
          if (!(b.uids || []).includes(by)) return `the hall's wait names ${by} as what calls for the seal, but it is none of the Centrepiece`;
          if (b.form === 'fight' && modeAt(pre, events, by, i) !== 'hunting') return `the hall's wait names ${by}, which was ${modeAt(pre, events, by, i)}, not hunting you`;
        }
        const inOpening = a => (b.openings || []).some(o => Actors.covers(a, o.x, o.y));
        if (inn !== undefined) {
          const at = post.actors.find(x => x.uid === inn);
          if (!changedAfter(events, i, inn) && (!at || !inOpening(at))) return `the hall said ${inn} stands in an opening, but it does not`;
          if (!changedAfter(events, i, inn) && !seen(post, at)) return `the hall named ${inn} in an opening, out of your sight`;
        } else if (!changedAfter(events, i, null)) {
          const there = post.actors.find(a => a.uid !== 'you' && !a.gone && inOpening(a) && seen(post, a));
          if (there) return `the hall named no one in its openings, but you see ${there.uid} in one`;
        }
        return null;
      },
    },
    {
      id: 'hall.alone',
      check(pre, events, post) {
        const c = cpOf(post);
        if (!c) return null;
        if (c.sealed && !piecesUp(post).some(a => bodyIn(post, a)) && piecesUp(post).length
          && !events.some(e => e.k === 'died' && (c.uids || []).includes(e.who))) return 'the hall is sealed with none of its Centrepiece in it: you are sealed in alone';
        const alone = of(events, 'unsealed').filter(e => e.cause.why === 'alone');
        if (!alone.length) return null;
        const at = events.indexOf(alone[0]);
        for (const a of piecesUp(pre)) {
          if (!bodyIn(pre, a)) continue;
          if (!events.slice(0, at).some(e => e.k === 'died' && e.who === a.uid)) return `the shutters opened as alone while ${a.uid} still stood in the hall`;
        }
        return null;
      },
    },
    {
      id: 'hall.quiet',
      check(pre, events, post) {
        const q = of(events, 'unsealed').filter(e => e.cause.why === 'quiet');
        if (!q.length) return null;
        const a = cpOf(pre), you = post.actors[0];
        if (!a || !a.sealed) return 'the shutters opened as quiet on a hall that was not sealed';
        if (q[0].turn - a.sealed.turn < N.SEAL_LIFT_TURNS) return `the shutters opened as quiet at turn ${q[0].turn}, ${q[0].turn - a.sealed.turn} turns after the seal`;
        const near = (a.uids || []).map(u => post.actors.find(x => x.uid === u)).find(x => x && !x.gone && Actors.dist(x, you.x, you.y) <= 1 && !events.some(e => e.k === 'moved' && e.who === x.uid));
        return near ? `the shutters opened as quiet with ${near.uid} beside you` : null;
      },
    },
  ];
};
