// SQUARE OFF — unit stats (DESIGN §2). All tunables; the sim reads only these.
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};

  // Counter cycle: crowd beats talker, talker beats heavy, heavy beats crowd.
  // counter[attacker][defender]
  const counter = {
    crowd: { crowd: 1.0, talker: 1.5, heavy: 0.7 },
    talker: { crowd: 0.7, talker: 1.0, heavy: 1.5 },
    heavy: { crowd: 1.5, talker: 0.7, heavy: 1.0 },
  };
  const beats = { crowd: 'talker', talker: 'heavy', heavy: 'crowd' };
  const weakTo = { crowd: 'heavy', talker: 'crowd', heavy: 'talker' };

  // Base class template (§2.1). Faction units deviate by at most ±20%.
  const template = {
    crowd: { cost: 40, perRecruit: 2, pop: 1, hp: 45, sway: 6, range: 1.5, speed: 5.0, splash: 0, weight: 1, recruitTime: 6, hitInterval: 1.0 },
    talker: { cost: 55, perRecruit: 1, pop: 1, hp: 55, sway: 9, range: 11, speed: 4.2, splash: 0, weight: 1, recruitTime: 7, hitInterval: 1.25 },
    heavy: { cost: 95, perRecruit: 1, pop: 2, hp: 220, sway: 9, range: 2.5, speed: 3.4, splash: 3, weight: 2, recruitTime: 11, hitInterval: 1.5 },
  };

  // cost is per recruit (a crowd recruit is a pair).
  const units = {
    hustle: {
      // Balance (sim-batch, Sim C): hp 45->46, Sway 5->5.5, speed 5.0->5.4
      crowd: { name: 'Kibitzers', single: 'Kibitzer', cost: 40, hp: 46, sway: 5.5, speed: 5.4,
        perks: ['unsolicitedAdvice'], glyph: '?', blurb: 'Unsolicited Advice: each Kibitzer next to an enemy cuts its Sway 10% (max 30%).' },
      // Balance: hp 55->61, speed 4.2->4.5 (it is the *Speed* Hustler)
      talker: { name: 'Speed Hustler', cost: 55, hp: 61, sway: 10, range: 12, speed: 4.5,
        perks: ['hitTheClock'], glyph: '♞', blurb: 'Hit the Clock: first hit on a new target slows it 30% for 2 s.' },
      // Balance: Sway 8->9, speed 3.2->3.4
      heavy: { name: 'Old Head', cost: 95, hp: 240, sway: 9, splash: 3, speed: 3.4,
        perks: ['seenItAll'], glyph: '!', blurb: 'Seen It All: immune to slows and knockback. Brought his own lawn chair.' },
    },
    noise: {
      crowd: { name: 'Tambourine Kids', single: 'Tambourine Kid', cost: 40, hp: 42, sway: 6, speed: 5.4,
        perks: ['tambourine'], glyph: '♪', blurb: 'Allies within 6 m move 10% faster.' },
      talker: { name: 'Sax Player', cost: 60, hp: 50, sway: 8, range: 11, speed: 4.2, targetSplash: 2.5,
        perks: ['saxSplash'], glyph: '♫', blurb: 'Each riff splashes 2.5 m around the target.' },
      // Balance: Sway 10->9.5, splash 4->3.5
      heavy: { name: 'Bucket Drummer', cost: 95, hp: 220, sway: 9.5, splash: 3.5, speed: 3.4,
        perks: ['flinch'], glyph: '♪', blurb: 'Splash 3.5 m. Each hit has a 10% chance to make the target flinch.' },
    },
    violets: {
      // Balance: Freshmen hp 38->42, Debate Team 50->52, Club Rugby 210->220 (before Group Project's -10%)
      crowd: { name: 'Freshmen', single: 'Freshman', cost: 32, hp: 42, sway: 5, speed: 5.4,
        perks: [], glyph: '!', blurb: 'Cheap, eager, and everywhere. Orientation was last week.' },
      talker: { name: 'Debate Team', cost: 55, hp: 52, sway: 9, range: 14, speed: 4.2,
        perks: ['wellActually'], glyph: '?', blurb: 'Well, Actually: +40% Sway against other ▲. Longest range in the park.' },
      heavy: { name: 'Club Rugby', cost: 90, hp: 220, sway: 10, splash: 3, speed: 3.6,
        perks: ['scrum'], glyph: '!', blurb: 'Scrum: first contact after a 6 m run knocks enemies back 3 m (12 s cooldown).' },
    },
    pack: {
      // Balance: speed 6.4->5.8 (still the fastest), Sway 7->6.5
      crowd: { name: 'Small-Dog Walkers', single: 'Small-Dog Walker', cost: 40, hp: 40, sway: 6.5, speed: 5.8,
        perks: ['animal'], glyph: 'woof', blurb: 'The fastest unit in the park. No lawn penalty.' },
      talker: { name: 'Ball-Launcher Dad', cost: 60, hp: 55, sway: 10, range: 12, speed: 4.2,
        perks: ['animal', 'fetch'], glyph: '!', blurb: 'Fetch!: every third hit pulls the target 3 m toward him (too much effort for a ■).' },
      heavy: { name: 'Pro Dog Walker', cost: 100, hp: 240, sway: 9, splash: 4, speed: 3.4,
        perks: ['animal', 'leashSlow'], glyph: 'woof', blurb: 'Eight leashes. Hit enemies are slowed 25% for 2 s.' },
    },
    // Non-playable campaign opponent (M1). Neutral: takes x1.0 from everything.
    squirrels: {
      crowd: { name: 'Squirrels', single: 'Squirrel', cost: 20, hp: 25, sway: 3, range: 1.2, speed: 5.5,
        perks: ['animal'], neutral: true, fleeAt: 0.5, glyph: '!', blurb: 'They flee at half Composure. They will be back.' },
      talker: { name: 'Squirrel Lookout', cost: 25, hp: 25, sway: 3, range: 6, speed: 5.0,
        perks: ['animal'], neutral: true, fleeAt: 0.5, glyph: '?', blurb: 'Chitters at you from a branch.' },
      heavy: { name: 'Fat Squirrel', cost: 40, hp: 60, sway: 4, range: 1.5, speed: 4.2, splash: 0,
        perks: ['animal'], neutral: true, fleeAt: 0.5, glyph: '!', blurb: 'Has eaten many pretzels.' },
    },
  };

  // Resolve full stat blocks and a flat type list. type index = position in list.
  const list = [];
  const byKey = {};
  for (const f of Object.keys(units)) {
    for (const cls of ['crowd', 'talker', 'heavy']) {
      const t = Object.assign({}, template[cls], units[f][cls]);
      t.key = f + '.' + cls;
      t.faction = f;
      t.cls = cls;
      t.splash = t.splash || 0;
      t.targetSplash = t.targetSplash || 0;
      t.unitCost = t.cost / t.perRecruit; // per-body cost (used for Grudge refunds)
      t.idx = list.length;
      t.single = t.single || t.name;
      units[f][cls] = t;
      list.push(t);
      byKey[t.key] = t;
    }
  }

  SQ.data.units = units;
  SQ.data.unitTemplate = template;
  SQ.data.unitTypes = list;
  SQ.data.unitTypeByKey = byKey;
  SQ.data.counter = counter;
  SQ.data.beats = beats;
  SQ.data.weakTo = weakTo;
  SQ.data.combat = {
    acquireExtra: 4,          // engage enemies within range + 4 m
    splashFrac: 0.7,          // heavies: secondary targets take 70%
    targetSplashFrac: 0.45,   // Sax riffs: secondary targets take 45%
    stickyTime: 2,            // seconds a target stays sticky
    retargetEvery: 0.25,
    talkerHoldFrac: 0.8,      // talkers hold at 80% of range
    talkerBackoff: 3,         // and back off 3 m ...
    talkerBackoffDist: 4,     // ... when an enemy crowd is within 4 m
    regen: 2, regenDelay: 5,  // 2/s after 5 s out of combat
    grudge: 0.25,             // 25% of cost back on Over It
    overItSpeed: 1.3,
    sight: 25,
    leash: 14,                // idle units chase at most this far from their anchor
    unitRadius: 0.45,
    separation: 0.9,
    advice: { radius: 2, per: 0.10, max: 0.30 },
    hitClock: { slow: 0.30, time: 2 },
    flinch: { chance: 0.10, time: 0.5 },
    scrum: { run: 6, knock: 3, cooldown: 12 },
    fetch: { every: 3, pull: 3 },
    leashSlow: { slow: 0.25, time: 2 },
    tambourine: { radius: 6, speed: 0.10 },
    wellActually: 0.40,
  };
})(window.SQ = window.SQ || {});
