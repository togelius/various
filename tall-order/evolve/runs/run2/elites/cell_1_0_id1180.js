// score 0.107  trigger 0.04  pace 0.03  (1890 chars)
// Special states first (hang, rider, carried, ladder, lift, spring); otherwise creep toward the goal, firing only when a target is in the band
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 40);
  if (o.dead) return {};
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit && (m.n % 10 === 0 || (!!bw && m.n % 3 === 0));
  const e = wrapA(Math.PI - o.yaw);

  // ladders: face west and push in
  if (o.climbing || (g.kind === 'ladder' && g.d < 2.5)) return { ...ladderSteer(o), fire: false, jump: false };
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(e) > 0.5) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.3 : 0, fire: false, jump: false };
    return { ...ladderSteer(o), fire: false, jump: false };
  }

  // lift: stand still on it as it rises
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: telegraphed(o, 4) };

  // stuck: wiggle and hop
  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.4, fire, jump: true };

  const edge = ledgeAhead(o, g);
  const heal = o.hp < 60 ? juiceNear(o, 6) : null;
  const tb = heal ? heal.b : g.b;
  const near = o.foes.some(f => f.awake && f.d < 4);
  const hop = telegraphed(o, 4) || (g.kind === 'crane-step' && g.d < 1.5);

  // walk slowly when roughly facing the goal; spring pads get a full push
  let mv = Math.abs(tb) > 1.2 || edge ? 0 : near ? 0.1 : 0.2;
  if (g.kind === 'spring' && g.d < 2.5 && Math.abs(tb) < 0.6) mv = 1;

  return { turn: steerTo(tb, 2), move: mv, fire, jump: hop };
}
