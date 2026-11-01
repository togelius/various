// ACCESSION — the invariants of Single File, Elbow Room and Second Wind (BUILD.md §8.1, §8.7;
// PG-PERKS-B), held after every step of every scenario, monkey, soak and bot run
// (tools/invariants.js). Each is what a perk's clause says, read back from the state before and
// after the step and the step's events, with the perk's numbers of record, never from its rule
// code (rules/perks/*.js). A perk counts when you hold it at rank 1 or 2 and it is not switched
// off for the visit (rulesOff).
//   perks_b.single_file  with Single File, every step of an exhibit that brings a tile of it
//                        onto a doorway (an open door or an archway) beside your tile then,
//                        one it did not cover before, is followed at once by the perk's
//                        event (cause single_file, who: it), unless that exhibit was counted
//                        before in the visit; it never comes otherwise, nor while the perk does
//                        not count, nor twice for one uid (dept.perk.filed keeps them, in
//                        order); at the second rank, and only then, it is dealt exactly
//                        PERK_SINGLE_FILE_DMG damage, cause perk single_file, which no Padding
//                        reduces (a swarm body's own rule takes all its health); then, if it
//                        still stands, it is staggered for STAGGER_TURNS turns, cause perk
//                        single_file (perks_a.staggered holds its lost action);
//   perks_b.elbow_room   with Elbow Room, your Padding once the step is done (counted where all
//                        stand as you choose your next action) is your kit's
//                        (Kit.stats, before any perk) plus PERK_ELBOW_ROOM[rank − 1] exactly
//                        while PERK_ELBOW_ROOM_ADJACENT or more exhibits stand beside you, not
//                        asleep and in no intact case (a vitrine under no tile of them); and
//                        every blow, shot or special that reached you in the step met the
//                        Padding counted when you acted (its cause's pad is your Padding before
//                        the step), so it holds until you act again;
//   perks_b.second_wind  with Second Wind, damage you live through that takes you from
//                        PERK_SECOND_WIND_BELOW_PCT% of your maximum health or more to below it
//                        is followed at once by the perk's event (cause wind, its total
//                        PERK_SECOND_WIND_PCT[rank − 1]% of your maximum health, rounded down)
//                        and second_wind put on you for PERK_SECOND_WIND_TURNS turns, the first
//                        time in the visit only; never otherwise; its heal (healed, cause
//                        second_wind) is yours, only while you hold second_wind, never past your
//                        maximum; and at each boundary of its turns its share is due, a share
//                        of the total for each of its turns, the night watch and a sealed hall
//                        notwithstanding: what it heals in a step is never more than the shares
//                        that fell due in it, and exactly them when nothing hurt you in the step
//                        and you end it below your maximum (so no heal was cut short).
'use strict';
module.exports = (C) => {
  const { N, Int } = C;
  const json = x => JSON.stringify(x);
  const actorIn = (s, uid) => { for (const a of s.actors) if (a.uid === uid) return a; return null; };
  const find = (a, id) => { for (const s of (a && a.statuses) || []) if (s.id === id) return s; return null; };
  // The rank a perk counts at: the rank you hold it at (0 if not), 0 while it is switched off.
  const rank = (s, id) => {
    if (s.options && Array.isArray(s.options.rulesOff) && s.options.rulesOff.includes(id)) return 0;
    for (const p of (s.run && s.run.perks) || []) if (p.id === id) return p.rank;
    return 0;
  };
  const part = (s, k) => s.dept && s.dept.perk && s.dept.perk[k] !== undefined ? s.dept.perk[k] : null;
  const tile = (s, x, y) => x >= 0 && y >= 0 && y < s.dept.h && x < s.dept.w ? s.dept.tiles[y][x] : '#';
  const DOORWAY = [',', "'"];
  const covered = (x0, y0, size, x, y) => x >= x0 && y >= y0 && x < x0 + size && y < y0 + size;
  const cheb = (x0, y0, x1, y1) => Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));

  const singleFile = {
    id: 'perks_b.single_file',
    check(pre, events, post) {
      const r = rank(pre, 'single_file'), before = part(pre, 'filed') || [], counted = before.slice();
      let you = [pre.actors[0].x, pre.actors[0].y];
      // A step's new tiles that are doorways beside you: by the tile at the step's end (strict:
      // a door opens, never closes, while the world acts, and nothing steps onto a closed one),
      // or also by the tile before the step (loose: an archway shards fell on in the step).
      const into = (a, e, loose) => {
        const size = (a && a.size) || 1;
        for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
          const x = e.to[0] + dx, y = e.to[1] + dy;
          if (covered(e.from[0], e.from[1], size, x, y) || cheb(x, y, you[0], you[1]) !== 1) continue;
          if (DOORWAY.includes(tile(post, x, y)) || (loose && DOORWAY.includes(tile(pre, x, y)))) return true;
        }
        return false;
      };
      for (let i = 0; i < events.length; i++) {
        const e = events[i], c = e.cause || {};
        if (e.k === 'moved' && e.who === 'you') { you = [e.to[0], e.to[1]]; continue; }
        if (e.k === 'moved') {
          const a = actorIn(post, e.who), next = events[i + 1];
          const fired = !!next && next.k === 'perk' && next.cause && next.cause.k === 'single_file' && next.cause.who === e.who;
          if (!fired) {
            if (r && !counted.includes(e.who) && into(a, e, false)) return `${e.who} stepped into a doorway beside you (${e.to}) with Single File at rank ${r}, the first time, and was not counted`;
            continue;
          }
          if (!r) return `Single File counted ${e.who}'s step, but it does not count`;
          if (counted.includes(e.who)) return `Single File counted ${e.who} a second time`;
          if (!into(a, e, true)) return `Single File counted ${e.who}'s step to ${e.to}, which brought it onto no doorway beside you (${you})`;
          if (next.id !== 'single_file' || next.rank !== r) return `Single File's event says ${json([next.id, next.rank])}, not single_file at rank ${r}`;
          counted.push(e.who);
          // What follows: at the second rank its damage, at once; then, if it stands, staggered.
          let j = i + 2;
          if (r >= 2) {
            const d = events[j];
            if (!d || d.k !== 'damaged' || d.who !== e.who || !d.cause || d.cause.k !== 'perk' || d.cause.id !== 'single_file') return `Single File at the second rank dealt ${e.who} no damage at once: ${json(d)}`;
            const swarm = !!a && a.arch === 'mote_swarm';
            if (d.amount !== N.PERK_SINGLE_FILE_DMG && !(swarm && d.hp === 0)) return `Single File dealt ${e.who} ${d.amount} damage, not ${N.PERK_SINGLE_FILE_DMG}`;
            j++;
          }
          const died = events.slice(j).some(x => x.k === 'died' && x.who === e.who && x.cause && x.cause.k === 'perk' && x.cause.id === 'single_file');
          const put = events.slice(j).find(x => x.k === 'status' && x.who === e.who && x.cause && x.cause.k === 'perk' && x.cause.id === 'single_file');
          const immune = !!a && C.Archetypes.immune(post, a, 'staggered');
          if (!died && !immune && (!put || put.id !== 'staggered' || !put.on || put.turns !== N.STAGGER_TURNS)) return `${e.who}, counted by Single File, was not staggered for ${N.STAGGER_TURNS} turns: ${json(put)}`;
          if (died && put) return `${e.who} fell to Single File's damage and was still staggered`;
          continue;
        }
        if (e.k === 'perk' && c.k === 'single_file') {
          const was = events[i - 1];
          if (!was || was.k !== 'moved' || was.who !== c.who) return `Single File counted ${c.who} with no step of it just before: ${json(was)}`;
        }
        if ((e.k === 'damaged' || e.k === 'status') && c.k === 'perk' && c.id === 'single_file') {
          if (!counted.includes(e.who) || before.includes(e.who)) return `Single File's ${e.k} on ${e.who}, which it did not count in this step`;
          if (e.k === 'damaged' && r < 2) return `Single File dealt damage at rank ${r}`;
        }
      }
      const after = part(post, 'filed') || [];
      return json(after) === json(counted) ? null : `dept.perk.filed is ${json(after)}, but Single File has counted ${json(counted)}`;
    },
  };

  // Your kit's Padding, before any perk (Kit.stats, as Kit.derive makes it without Perks.padding).
  function kitPad(s) {
    const kit = s.you && s.you.kit;
    if (!kit) return 0;
    const it = uid => (uid ? s.items.find(i => i.uid === uid) : null) || null;
    const grade = s.run ? s.run.grade : N.GRADE_START;
    return C.Kit.stats(it(kit.weapon), it(kit.garment), grade, [it(kit.curio[0]), it(kit.curio[1]), it(kit.instrument)].filter(Boolean)).pad;
  }
  const encased = (s, a) => { const k = a.size || 1; for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) if (tile(s, a.x + dx, a.y + dy) === 'v') return true; return false; };
  // The exhibits beside you that Elbow Room counts.
  function beside(s) {
    const you = s.actors[0];
    let n = 0;
    for (let i = 1; i < s.actors.length; i++) {
      const a = s.actors[i], k = a.size || 1;
      if (a.gone || a.mode === 'dormant' || encased(s, a)) continue;
      const nx = Math.min(Math.max(you.x, a.x), a.x + k - 1), ny = Math.min(Math.max(you.y, a.y), a.y + k - 1);
      if (cheb(nx, ny, you.x, you.y) === 1) n++;
    }
    return n;
  }
  const elbowRoom = {
    id: 'perks_b.elbow_room',
    check(pre, events, post) {
      const r0 = rank(pre, 'elbow_room'), r = rank(post, 'elbow_room'), you = post.actors[0];
      if (r0) for (const e of events) {
        if (e.k !== 'damaged' || e.who !== 'you' || !e.cause || !Number.isInteger(e.cause.pad)) continue;
        if (e.cause.pad !== pre.actors[0].pad) return `with Elbow Room, a ${e.cause.k} at tick ${e.tick} met your Padding ${e.cause.pad}, not ${pre.actors[0].pad}, the Padding counted when you acted`;
      }
      if (!r || you.gone) return null;
      const n = beside(post), want = kitPad(post) + (n >= N.PERK_ELBOW_ROOM_ADJACENT ? N.PERK_ELBOW_ROOM[r - 1] : 0);
      return you.pad === want ? null : `with Elbow Room at rank ${r} and ${n} exhibit(s) beside you your Padding is ${you.pad}, not ${want}`;
    },
  };

  // The shares of Second Wind's heal due by a state's turn: [due health, held], from its record
  // (dept.perk.wind {turn, total}) and your second_wind status: none before it comes; while
  // the status covers turns from `from`, a share for each of them whose boundary has come since
  // it came (the turn it came in, its boundary past, is due at the next); all once it has ended.
  const T = N.PERK_SECOND_WIND_TURNS;
  function due(s) {
    const w = part(s, 'wind');
    if (!w) return 0;
    const st = find(s.actors[0], 'second_wind');
    if (!st) return w.total;
    if (!Number.isInteger(st.from)) return 0;
    const first = Math.max(st.from, w.turn + 1);
    return s.turn < first ? 0 : Int.idiv(w.total * Math.min(T, s.turn - st.from + 1), T);
  }
  const secondWind = {
    id: 'perks_b.second_wind',
    check(pre, events, post) {
      const r = rank(pre, 'second_wind'), B = N.PERK_SECOND_WIND_BELOW_PCT;
      let hp = pre.actors[0].hp, max = pre.actors[0].maxHp, came = !!part(pre, 'wind'), held = !!find(pre.actors[0], 'second_wind'), hurt = false, healed = 0;
      const brought = new Set();
      for (let i = 0; i < events.length; i++) {
        const e = events[i], c = e.cause || {};
        if (e.k === 'grade' && c.k === 'certificate') max += N.HP_PER_GRADE;
        if ((e.k === 'healed' || e.k === 'regenerated') && e.who === 'you') hp = e.hp;
        if (e.k === 'healed' && c.k === 'second_wind') {
          if (e.who !== 'you') return `Second Wind healed ${e.who}`;
          if (!held) return 'Second Wind healed you while you were not getting your second wind';
          if (e.hp > max || e.amount < 1) return `Second Wind healed you ${e.amount} to ${e.hp}, past your maximum ${max}`;
          healed += e.amount;
        }
        if (e.k === 'status' && e.who === 'you' && e.id === 'second_wind') held = !!e.on;
        if (e.k === 'perk' && c.k === 'wind') {
          const was = events[i - 1];
          if (!was || !brought.has(i - 1)) return `Second Wind came with no damage that took you below ${B}% just before it: ${json(was)}`;
        }
        if (e.k !== 'damaged' || e.who !== 'you') continue;
        hurt = true;
        const from = hp;
        hp = e.hp;
        const crossed = e.hp > 0 && 100 * from >= B * max && 100 * e.hp < B * max;
        if (!r || came || !crossed) continue;
        // It comes, at once: its event with the total, then the status.
        const p = events[i + 1], s = events[i + 2], total = Int.pct(max, N.PERK_SECOND_WIND_PCT[r - 1]);
        if (!p || p.k !== 'perk' || !p.cause || p.cause.k !== 'wind' || p.id !== 'second_wind' || p.rank !== r || p.cause.total !== total)
          return `damage took you from ${from} to ${e.hp} of ${max}, below ${B}%, with Second Wind at rank ${r}, but it did not come at once to heal ${total}: ${json(p)}`;
        if (!s || s.k !== 'status' || s.who !== 'you' || s.id !== 'second_wind' || !s.on || s.turns !== T || !s.cause || s.cause.k !== 'perk' || s.cause.id !== 'second_wind')
          return `Second Wind came but did not put on second_wind for ${T} turns: ${json(s)}`;
        brought.add(i);
        came = true;
      }
      const w0 = part(pre, 'wind'), w1 = part(post, 'wind');
      if (w0 && (!w1 || w0.turn !== w1.turn || w0.total !== w1.total)) return `Second Wind's record changed from ${json(w0)} to ${json(w1)}`;
      if (!!w1 !== came) return `dept.perk.wind is ${json(w1)}, but Second Wind ${came ? 'came' : 'never came'}`;
      const owed = due(post) - due(pre);
      if (healed > owed) return `Second Wind healed you ${healed} in the step, more than the ${owed} its shares made due`;
      if (healed < owed && !hurt && !post.over && post.actors[0].hp < post.actors[0].maxHp) return `Second Wind healed you ${healed} in the step, not the ${owed} its shares made due (turn ${post.turn}${C.Clock && post.dept.clock ? `, clock stage ${post.dept.clock.stage}` : ''})`;
      return null;
    },
  };

  return [singleFile, elbowRoom, secondWind];
};
