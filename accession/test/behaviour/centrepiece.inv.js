// What every Centrepiece shares (BUILD.md §5.5, §8.1, §8.2, §8.7; M4 plan A8, D3, R4), as
// invariants checked after every step. Each is written from the rules' sentences, not from
// rules/centrepiece.js. They hold for a Centrepiece the core placed (its pieces carry ax.phase);
// a room for tests that only names pieces in dept.cp (the hall's tests) is held to the wake
// rule alone.
//   centrepiece.phase   its pieces share one phase, which never goes back; each phase entered
//                       in a step has its phase event, in order, and no other phase event comes;
//                       while a piece stands, its phase is at least the one its health gives
//                       (one more for each of CP_PHASE_PCT, % of its pieces' maximums together,
//                       that their health has fallen to);
//   centrepiece.marks   each special of one of its pieces that strikes you deals what its mark
//                       showed on that tile the moment before (Specials.marks), and was shown;
//   centrepiece.fall    the step its last standing piece dies: a fight's Signature piece drops
//                       to the floor at its footprint's top-left tile (dept.cp.at), once, and
//                       the Certificate follows it (by defeat, naming its first piece when that
//                       piece is called by the Centrepiece's own name, else none: an ensemble's
//                       pieces have names of their own) unless one was earned already; a sealed hall opens; a treasure's guardian earns
//                       nothing (no drop, no Certificate); no drop or Certificate by defeat
//                       comes in any other step;
//   centrepiece.sleep   a piece wakes from pips and damage only: never by a herald's call, the
//                       night-watch bell, the alarm or a chime.
'use strict';
module.exports = (C) => {
  const { N } = C;
  const json = JSON.stringify;
  const cpOf = s => (s && s.dept && s.dept.cp) || null;
  const byUid = (s, uid) => s.actors.find(a => a.uid === uid) || null;
  const piecesOf = s => { const c = cpOf(s); return c && Array.isArray(c.uids) ? c.uids.map(u => byUid(s, u)).filter(Boolean) : []; };
  // A Centrepiece the core placed: every piece carries its phase.
  const placed = s => { const p = piecesOf(s); return p.length > 0 && p.every(a => a.ax && Number.isInteger(a.ax.phase)); };
  const phaseOf = s => Math.max(1, ...piecesOf(s).map(a => (a.ax && Number.isInteger(a.ax.phase) ? a.ax.phase : 1)));
  const isPiece = (s, uid) => { const c = cpOf(s); return !!c && Array.isArray(c.uids) && c.uids.includes(uid); };
  const standing = s => piecesOf(s).filter(a => !a.gone);
  // The phase its health gives, from §8.10's words: CP_PHASE_PCT, % of its total health.
  function healthPhase(s) {
    let hp = 0, max = 0;
    for (const a of piecesOf(s)) { max += a.maxHp; if (!a.gone) hp += a.hp; }
    let k = 1;
    for (const p of N.CP_PHASE_PCT) if (hp * 100 <= max * p) k++;
    return k;
  }

  return [
    {
      id: 'centrepiece.phase',
      check(pre, events, post) {
        if (!placed(post)) return null;
        const list = piecesOf(post), k = phaseOf(post), was = placed(pre) ? phaseOf(pre) : 1;
        for (const a of list) if (a.ax.phase !== k) return `its pieces are in different phases: ${json(list.map(b => [b.uid, b.ax.phase]))}`;
        if (k < was) return `its phase went back from ${was} to ${k}`;
        const told = events.filter(e => e.k === 'phase' && isPiece(post, e.who));
        const want = [];
        for (let p = was + 1; p <= k; p++) want.push(p);
        if (json(told.map(e => e.phase)) !== json(want)) return `it went from phase ${was} to ${k}, but the phase events say ${json(told.map(e => e.phase))}`;
        if (standing(post).length && !post.over && k < healthPhase(post)) return `its health gives phase ${healthPhase(post)}, but it is in phase ${k}`;
        return null;
      },
    },
    {
      id: 'centrepiece.marks',
      check(pre, events, post) {
        if (!placed(post) && !placed(pre)) return null;
        const shown = C.Specials.marks(pre);
        for (const e of events) {
          if (e.k !== 'damaged' || e.who !== 'you' || !e.cause) continue;
          const c = e.cause, owner = c.k === 'special' ? c.by : c.k === 'reflected' ? c.shooter : null;
          if (typeof owner !== 'string' || !isPiece(post, owner)) continue;
          const m = shown.find(r => r.by === owner && r.x === c.x && r.y === c.y && r.kind === 'telegraph');
          if (!m) return `${owner}'s ${c.sp} struck you at ${c.x},${c.y}, which its mark did not show the moment before`;
          if (m.dmg !== e.amount) return `${owner}'s ${c.sp} showed ${m.dmg} at ${c.x},${c.y} and dealt you ${e.amount}`;
        }
        return null;
      },
    },
    {
      id: 'centrepiece.fall',
      check(pre, events, post) {
        const c = cpOf(post), drops = events.filter(e => e.k === 'dropped' && e.cause && e.cause.k === 'defeated');
        const certs = events.filter(e => e.k === 'certificate' && e.cause && e.cause.k === 'defeat');
        const fell = !!c && placed(post) && standing(pre).length > 0 && standing(post).length === 0
          && events.some(e => e.k === 'died' && isPiece(post, e.who));
        if (!fell) {
          if (drops.length) return `a Signature piece dropped though the Centrepiece did not fall: ${json(drops)}`;
          if (certs.length) return `a Certificate by defeat came though the Centrepiece did not fall: ${json(certs)}`;
          return null;
        }
        if (c.form === 'treasure') {
          if (drops.length || certs.length) return `a treasure's guardian fell, and it gave ${json(drops.concat(certs))}; killing it earns nothing`;
        }
        // A step that ends the visit (you fall with it) gives nothing more.
        if (post.over) return null;
        if (c.form === 'fight') {
          if (typeof c.signature === 'string') {
            if (drops.length !== 1) return `the Centrepiece fell, and ${drops.length} Signature pieces dropped, not 1`;
            const d = drops[0], it = post.items.find(i => i.uid === d.item), at = c.at;
            if (!it || it.ref !== c.signature || it.where.at !== 'floor' || it.where.x !== at[0] || it.where.y !== at[1] || d.x !== at[0] || d.y !== at[1])
              return `its Signature piece ${json(d)} is ${json(it ? { ref: it.ref, where: it.where } : null)}, not ${c.signature} on the floor at ${at}`;
            if (pre.items.some(i => i.uid === d.item)) return `the Signature piece ${d.item} was there before it fell`;
          } else if (drops.length) return `a Signature piece dropped, but the Centrepiece names none: ${json(drops)}`;
          const had = !!(pre.dept && pre.dept.cert);
          if (certs.length !== (had ? 0 : 1)) return `the Centrepiece fell with ${had ? 'a' : 'no'} Certificate earned, and ${certs.length} came by defeat`;
          // (Its first piece names it when called by its record's name: Packs.speciesFor.)
          const pack = C.Packs.get(post.dept.acc), rec = pack && pack.centrepiece, first = byUid(post, c.uids[0]), sp = first ? C.Packs.speciesFor(post, first) : null;
          const names = !rec || !sp || sp.name === rec.name ? c.uids[0] : undefined;
          if (certs.length && certs[0].cause.by !== names) return `the Certificate names ${certs[0].cause.by}, not ${names === undefined ? 'no piece (its first piece has a name of its own)' : `the Centrepiece's first piece ${names}`}`;
          if (certs.length && drops.length && events.indexOf(certs[0]) < events.indexOf(drops[0])) return 'the Certificate came before the Signature piece dropped';
        }
        if (c.sealed) return 'the Centrepiece fell, and its hall is still sealed';
        return null;
      },
    },
    {
      id: 'centrepiece.sleep',
      check(pre, events, post) {
        for (const e of events) {
          if (e.k !== 'woke' || !isPiece(post, e.who) || !e.cause) continue;
          if (['herald', 'night_bell', 'alarm', 'period'].includes(e.cause.k)) return `${e.who}, a piece of the Centrepiece, woke by ${e.cause.k}: only pips and damage wake it`;
        }
        return null;
      },
    },
  ];
};
