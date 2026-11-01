// ACCESSION — the module alarm_network (S.9; BUILD.md §5.4): "The waders raise the alarm when
// they see you; then every sleeping exhibit in the department that can hear, but the
// Centrepiece, wakes." Its rules register here with Modules.define
// (rules/modules.js) in the form of §5.4; its archetype: rules/arch/patrol_guard.js (the Wader);
// its entries in js/core/reg/mod-alarm.js and its sentences in js/core/text/mod-alarm.js.
// Owned by MOD-ALARM.
//
// The rule (§5.4; M4 plan MO6–MO8, D1.6–D1.8), as the Wader's line says it:
//   - Shown. A Wader (a species flagged with alarm_network) that sees you while hunting you,
//     when no alarm is running and none is shown, marks its special `alarm` on its own tile
//     instead of acting otherwise (patrol_guard's act; AlarmNetwork.mayShow): the telegraph,
//     a call with no tiles but its own, shown for a turn as every mark is (§8.1), so you
//     always see it before it goes off; only one is shown at a time. Rule `alarm_shown`
//     tells it (module {rule: 'alarm_shown', who}).
//   - The call. At the Wader's next action the mark goes off (Specials.resolve; its onResolve
//     calls AlarmNetwork.call): a crash at its tile (a noise, which wakes and stirs as any
//     crash does), then every exhibit still asleep that can hear (not pipless: never a mimic
//     in its disguise) and is not a Centrepiece's piece (which only pips and damage wake,
//     §8.2) wakes awake, sent to look at the tile you stand on as the call goes off (cause
//     alarm, with the Wader's uid; how 'case' for one in an intact case, which wakes in it and
//     stays there, §8.3), in spawn order, wherever in the department it is. The crash comes
//     first, against §8.2's order for one action (its other wakes before its noise): the other
//     way round, the crash would send every exhibit the call had just woken within its reach to
//     look at the Wader's tile, not at yours, as the call says. Then,
//     on the `special` event that says the mark went off, rule `call` raises the alarm:
//     module {rule: 'call', who, at, n} (n the exhibits the call woke), the `alarm` effect
//     (dept.modules' entry gets alarm {by, since, until}, until = now + ALARM_TURNS, and the
//     alarm event {by, until}) and the `clock` effect (ClockRules.advance by
//     ALARM_CLOCK_ADVANCE, cause alarm_network with the Wader's uid: the bell, and the night
//     watch with it, or after the bell the night watch, comes that much sooner, never sooner
//     than the next turn, and nothing in the night watch; its stage event says which).
//   - While it runs (turns since ≤ t < until): no pip decays (pipsDecay), no exhibit goes back
//     to its place for being left undisturbed or done searching (mayReturn: AI's idle and
//     searched returns; one already going back goes on, and a tethered warden still goes back
//     when you leave its tether, its own rule), and no other alarm is shown or raised
//     (mayShow).
//   - Over. At the turn boundary of its last turn (step 7, alarmDecay) it ends: the module's
//     alarm is absent again (M4 plan A3), and rule `alarm_over` says so (module {rule:
//     'alarm_over', turns}, its cause saying whether pips fade again: fade, false after the
//     bell, when they never fade).
// With the module off (rulesOff, or a visit without it) none of this happens: no Wader
// shows or raises the alarm, it only chases (the archetype's own clause).
//
// Bespoke (plan A7, MO18; the validation log, Modules.bespoke): the alarm's lasting effects
// (pipsDecay, mayReturn, alarmDecay, which ends it with its own module event); the call's
// crash and wakes (AlarmNetwork.call), which wake many exhibits at once, where the form's
// `wake` effect acts on one target a module event, and would name each woken exhibit as
// that event's `who`, an exhibit whose line does not carry the module (§10.3); and the
// Wader's showing the alarm (patrol_guard's act), the archetype's own special marked while
// the module allows it.
//
// AlarmNetwork, for the archetype, the view model and the tests:
//   AlarmNetwork.of(state) → the module's state (its dept.modules entry), on, or null
//   AlarmNetwork.running(state) → bool          an alarm runs now
//   AlarmNetwork.left(state) → int              turns until it ends (0 when none runs)
//   AlarmNetwork.shown(state) → uid | null      the exhibit showing the alarm now
//   AlarmNetwork.mayShow(state, a) → bool       may a show the alarm now: the module on, a
//                                               flagged with it, none running or shown
//   AlarmNetwork.sleepers(state) → [actor]      those a call would wake now, in spawn order
//   AlarmNetwork.call(state, a, ev) → int       a's call goes off: the crash and the wakes;
//                                               the number woken (0, and nothing done, if the
//                                               module is off or an alarm already runs)
'use strict';
const AlarmNetwork = (() => {
  const ID = 'alarm_network';

  // The module's state while it is on, or null (absent from the visit, or switched off).
  const of = state => Modules.on(state, ID) ? Modules.of(state, ID) : null;
  const runningIn = (state, m) => !!m && !!m.alarm && Number.isInteger(m.alarm.until) && state.turn < m.alarm.until;
  const running = state => runningIn(state, of(state));
  const left = state => { const m = of(state); return runningIn(state, m) ? m.alarm.until - state.turn : 0; };
  // The exhibit whose alarm mark is pending, or null.
  function shown(state) {
    for (const a of state.actors) if (!a.gone && a.telegraph && a.telegraph.sp === 'alarm') return a.uid;
    return null;
  }
  const mayShow = (state, a) => Modules.flagged(state, a, ID) && !running(state) && shown(state) === null;
  // Every exhibit asleep that can hear and is no Centrepiece's piece, in spawn order.
  const sleepers = state => state.actors.filter((b, i) => i > 0 && !b.gone && b.mode === 'dormant' && !Archetypes.pipless(state, b) && !Actors.centrepiece(b));

  // The call of a's alarm, at its tile: first the crash, then every exhibit still asleep that
  // can hear, but a Centrepiece's pieces, wakes awake, sent to look at your tile now. Each is
  // checked again as its turn comes, since a waking emits events other rules may act on.
  function call(state, a, ev) {
    if (!of(state) || running(state)) return 0;
    Noise.emit(state, a.x, a.y, 'crash', { k: 'alarm', by: a.uid }, ev);
    const you = state.actors[0], target = [you.x, you.y];
    let n = 0;
    for (const b of sleepers(state)) {
      if (b.gone || b.mode !== 'dormant') continue;
      // One in an intact case wakes in it and stays there (§8.3); its cause says so (how).
      const cause = Object.assign({ k: 'alarm', by: a.uid, x: target[0], y: target[1] }, Cases.encased(state, b) ? { how: 'case' } : {});
      if (!Wake.wake(state, b, 'awake', cause, ev, { target })) throw new Error(`AlarmNetwork: the call could not wake ${b.uid}`);
      n++;
    }
    return n;
  }

  // The exhibits the call by a woke, this turn (their story says so).
  const woken = (state, a) => state.actors.filter(b => b.woke && b.woke.turn === state.turn && b.woke.cause && b.woke.cause.k === 'alarm' && b.woke.cause.by === a.uid).length;
  // The exhibit present an event names (who), as a rule's target, or none.
  const named = (state, uid) => state.actors.filter((b, i) => i > 0 && !b.gone && b.uid === uid);

  Modules.define(ID, {
    rules: [
      // A Wader showed the alarm: its special's mark, made in its own action.
      { rule: 'alarm_shown', on: 'telegraphed', who: (state, e) => e.sp === 'alarm' ? named(state, e.who) : [],
        do: [{ k: 'flag', name: 'shown', value: (state, e, m, a) => ({ by: a.uid, turn: state.turn }) }] },
      // Its call went off: the alarm is raised, and the clock brought nearer.
      { rule: 'call', on: 'special', who: (state, e) => e.sp === 'alarm' && !e.cancelled ? named(state, e.who) : [],
        when: (state, e, m) => !runningIn(state, m),
        fields: (state, e, m, a) => ({ at: [a.x, a.y], n: woken(state, a) }),
        telegraph: { turns: 1, shown: 'alarm' },
        do: [{ k: 'alarm', turns: N.ALARM_TURNS }, { k: 'clock', n: N.ALARM_CLOCK_ADVANCE, cause: (state, e, m, a) => ({ k: ID, by: a.uid }) }] },
    ],
    bespoke: ['pipsDecay', 'mayReturn', 'alarmDecay', 'AlarmNetwork.call', 'patrol_guard.act'],
    // While it runs, no pip decays and no idle or searched exhibit goes back.
    pipsDecay: (state, m) => !runningIn(state, m),
    mayReturn: (state, a, m) => !runningIn(state, m),
    // Its last turn is up: it ends, and says so, and whether pips fade again (fade: not
    // after the bell, when they never fade, §8.2).
    alarmDecay(state, ev, m) {
      if (!m.alarm || runningIn(state, m)) return;
      const turns = m.alarm.until - m.alarm.since;
      delete m.alarm;
      Causes.emit(state, ev, 'module', { id: ID, rule: 'alarm_over', turns }, { k: ID, fade: Clock.pipsDecay(state) });
    },
  });

  return { of, running, left, shown, mayShow, sleepers, call };
})();
