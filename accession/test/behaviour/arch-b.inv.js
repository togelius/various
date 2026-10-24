// ACCESSION — Behaviour-line invariants for W1-ARCH-B's clauses (BUILD.md §5.3, check 1): the
// kiter, the axis_sniper and its `line` beam, the reflector, and the glass and old_repair
// modifiers. tools/invariants.js runs them after every step of every scenario, monkey, soak
// and bot run. Each is checked once a step, from the step's events and the states before
// and after it, and each restates its rule here from BUILD.md's text rather than calling
// the rule's code. Their ids start arch_b_, so no other package's can clash with them.
'use strict';
module.exports = (C) => {
  const N = C.N;
  const at = (s, uid) => (s && s.actors.find(a => a.uid === uid)) || null;
  const same = (p, x, y) => p[0] === x && p[1] === y;
  const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;
  const off = (s, id) => !!(s.options && s.options.rulesOff.includes(id));
  // A reflector sends beams and bolts back: the reflector archetype, or a glass body while
  // glass is on (BUILD.md §5.5). Gone or not, as it was when it was struck.
  const reflects = (s, a) => a.arch === 'reflector' || (a.mods.includes('glass') && !off(s, 'glass'));
  // Where an actor stood when events[i] happened: where its first move after that event
  // started, else where it stands now (exhibits change tile only by moving).
  function tileAt(events, i, a) {
    for (let j = i + 1; j < events.length; j++) if (events[j].k === 'moved' && events[j].who === a.uid) return events[j].from;
    return [a.x, a.y];
  }
  // Was b there (not gone) when events[i] happened? Not if it was gone before the step or
  // destroyed earlier in it; an actor the step created is left out, so a check can only be
  // too lenient about it, never wrong.
  function presentAt(pre, events, i, b) {
    const was = at(pre, b.uid);
    if (!was || was.gone) return false;
    for (let j = 0; j < i; j++) if (events[j].k === 'died' && events[j].who === b.uid) return false;
    return true;
  }

  return [
    {
      // §8.1: a special's damage lands only on the tiles it marked, and what you take is what
      // the mark showed: max(DMG_MIN_ON_HIT, gross − your Padding).
      id: 'arch_b_line_hits_marked_tiles',
      check(pre, events, post) {
        if (!pre) return null;
        for (const e of events) {
          if (e.k !== 'damaged' || !e.cause || e.cause.k !== 'special' || e.cause.sp !== 'line') continue;
          const c = e.cause, owner = at(pre, c.by), tel = owner && owner.telegraph;
          if (!tel || tel.sp !== 'line') return `${e.who} took a beam's damage from ${c.by}, which had no beam marked before the step`;
          if (!tel.tiles.some(t => same(t, c.x, c.y))) return `${c.by}'s beam struck ${e.who} at ${c.x},${c.y}, a tile it never marked`;
          if (c.gross !== tel.gross) return `${c.by}'s beam struck for gross ${c.gross}, but its mark said ${tel.gross}`;
          if (e.who === 'you') {
            const pad = pre.actors[0].pad, net = Math.max(N.DMG_MIN_ON_HIT, tel.gross - pad);
            if (c.pad !== pad || e.amount !== net) return `${c.by}'s beam dealt you ${e.amount} through Padding ${c.pad}; its mark showed ${net} (gross ${tel.gross}, Padding ${pad})`;
          }
        }
        return null;
      },
    },
    {
      // §8.1: a beam marks its owner's row or column, and nothing beyond the first reflector
      // on its way out toward you (where it turns back).
      id: 'arch_b_line_stops_at_reflector',
      check(pre, events, post) {
        if (!pre) return null;
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.k !== 'telegraphed' || e.sp !== 'line') continue;
          const owner = at(post, e.who), you = post.actors[0];
          if (!owner) return `${e.who} marked a beam and is not in the state`;
          const [ox, oy] = tileAt(events, i, owner);
          const row = e.tiles.every(t => t[1] === oy), col = e.tiles.every(t => t[0] === ox);
          if (!row && !col) return `${e.who}'s beam marks tiles off its row and column: ${JSON.stringify(e.tiles)}`;
          const dx = row ? sign(you.x - ox) : 0, dy = col && !row ? sign(you.y - oy) : 0;
          if (dx === 0 && dy === 0) continue;
          let stop = -1;
          for (let k = 1; k <= N.AXIS_BEAM_RANGE && stop < 0; k++) {
            const x = ox + dx * k, y = oy + dy * k;
            for (const b of post.actors) if (b !== owner && reflects(post, b) && presentAt(pre, events, i, b) && same(tileAt(events, i, b), x, y)) stop = k;
          }
          if (stop < 0) continue;
          for (const t of e.tiles) {
            const k = dx ? (t[0] - ox) * dx : (t[1] - oy) * dy;
            if (k > stop) return `${e.who}'s beam marks ${t[0]},${t[1]}, beyond the reflector ${stop} tiles along its way out`;
          }
        }
        return null;
      },
    },
    {
      // The axis_sniper's clause: it never strikes (it has no blow and shoots no bolts).
      id: 'arch_b_axis_sniper_never_strikes',
      check(pre, events, post) {
        for (const e of events) {
          if (e.k !== 'attacked') continue;
          const a = at(post, e.by);
          if (a && a.arch === 'axis_sniper') return `${e.by}, an axis_sniper, attacked ${e.at} (${JSON.stringify(e.how)})`;
        }
        return null;
      },
    },
    {
      // The kiter's clause: it shoots up to ROLE_ARTILLERY_RANGE tiles.
      id: 'arch_b_kiter_shot_range',
      check(pre, events, post) {
        for (const e of events) {
          if (e.k !== 'attacked' || !e.how || e.how.kind !== 'shot') continue;
          const a = at(post, e.by);
          if (a && a.arch === 'kiter' && !(e.cause.dist <= N.ROLE_ARTILLERY_RANGE)) return `${e.by}, a kiter, shot ${e.at} from ${e.cause.dist} tiles, beyond ${N.ROLE_ARTILLERY_RANGE}`;
        }
        return null;
      },
    },
    {
      // The reflector's clause: a shot that meets a reflector comes back into whoever fired it,
      // so nothing behind the reflector is hit; and no shot strikes a reflector itself.
      id: 'arch_b_reflected_shots_come_back',
      check(pre, events, post) {
        for (const e of events) {
          const c = e.cause;
          if (!c || (e.k !== 'damaged' && e.k !== 'missed')) continue;
          const who = e.k === 'damaged' ? e.who : e.at;
          if (c.k === 'reflected' && c.sp == null && who !== c.shooter) return `${c.by} sent ${c.shooter}'s shot back into ${who}, not into ${c.shooter}`;
          if ((c.k === 'shot' || c.k === 'item') && c.how && c.how.kind === 'shot' && e.k === 'damaged') {
            const v = at(post, who);
            if (v && reflects(post, v)) return `${c.by}'s shot struck ${who}, which sends shots back`;
          }
        }
        return null;
      },
    },
    {
      // §8.3, the one shard rule: shards land only on floor or an archway, so never over a
      // door, an exit, the entrance, a bench or a case.
      id: 'arch_b_shards_on_floor',
      check(pre, events, post) {
        if (!pre) return null;
        const a = pre.dept.tiles, b = post.dept.tiles;
        for (let y = 0; y < b.length; y++) {
          if (a[y] === b[y]) continue;
          for (let x = 0; x < b[y].length; x++) if (b[y][x] === 'x' && a[y][x] !== 'x' && a[y][x] !== '.' && a[y][x] !== ',') return `shards at ${x},${y} over '${a[y][x]}'`;
        }
        return null;
      },
    },
    {
      // The old_repair clause: damage from the repaired side (its compass point and the two
      // beside it, seen from the body's nearest tile toward where the damage came from) is
      // doubled, and its cause says so; from anywhere else it is not.
      id: 'arch_b_old_repair_side',
      check(pre, events, post) {
        const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];
        const PLAIN = ['plodder', 'kiter', 'axis_sniper', 'reflector'], QUIET_MODS = ['old_repair', 'glass', 'marble'];
        for (let i = 0; i < events.length; i++) {
          const e = events[i], c = e.cause;
          if (e.k !== 'damaged' || !c || !Array.isArray(c.from)) continue;
          const a = at(post, e.who);
          if (!a) continue;
          if (!a.mods.includes('old_repair') || off(post, 'old_repair')) {
            if (c.side != null) return `${e.who} has no old repair at work, yet its damage says side ${c.side}`;
            continue;
          }
          const side = a.modParams.old_repair && a.modParams.old_repair.side, d = POINTS.indexOf(side);
          const [x, y] = tileAt(events, i, a), s = a.size || 1;
          const nx = Math.min(Math.max(c.from[0], x), x + s - 1), ny = Math.min(Math.max(c.from[1], y), y + s - 1);
          const sx = sign(c.from[0] - nx), sy = sign(c.from[1] - ny);
          let p = -1;
          for (let k = 0; k < 8; k++) if (DX[k] === sx && DY[k] === sy) p = k;
          const on = d >= 0 && p >= 0 && (p === d || p === (d + 1) % 8 || p === (d + 7) % 8);
          if (on !== (c.side === side)) return `${e.who}'s damage from ${c.from} ${on ? 'came through' : 'did not come through'} its repaired ${side} side, but its cause says side ${c.side == null ? 'none' : c.side}`;
          // The number, where nothing else changes damage: the net damage, doubled through the side.
          if (!PLAIN.includes(a.arch) || !a.mods.every(m => QUIET_MODS.includes(m))) continue;
          const base = c.net !== undefined ? c.net : Number.isInteger(c.raw) && Number.isInteger(c.pad) ? Math.max(N.DMG_MIN_ON_HIT, c.raw - c.pad) : null;
          if (base === null) continue;
          const want = on ? C.Int.pct(base, N.OLD_REPAIR_PCT) : base;
          if (e.amount !== want) return `${e.who} took ${e.amount} from ${c.from}; ${on ? 'through its repaired side' : 'away from its repaired side'} that is ${want}`;
        }
        return null;
      },
    },
  ];
};
