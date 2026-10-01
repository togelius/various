// Regression scenarios for the tool incentives: counters, the Fork's opening, hugs, the golden chase,
// the variety meter and the ability stashes.
function testTools() {
  const out = [], oldTimer = window.setTimeout;
  window.setTimeout = () => 0;
  const check = (name, ok) => { if (!ok) throw Error(name); out.push('PASS ' + name); };
  const fresh = () => { reset(); hideScreen(); state = 'play'; locked = true; mouseDown = false; continues = 0; interT = 9999; waveActive = false; for (const k in keys) keys[k] = false; };
  try {
    fresh();
    const roll = makeEnemy('roll', P.x + 20, P.z), bottle = makeEnemy('bottle', P.x + 20, P.z), sponge = makeEnemy('sponge', P.x + 20, P.z), spoon = makeEnemy('spoon', P.x + 20, P.z);
    check('Water barely dents the paper towel and fizz tears it', toolFactor(roll, 0) < .3 && toolFactor(roll, 2) > 1.5);
    check('Ice shatters glass that shrugs off water', toolFactor(bottle, 1) > 1.4 && toolFactor(bottle, 0) < .6);
    check('An ordinary sponge takes water normally', toolFactor(sponge, 0) === 1);
    sponge.storedWater = 8;
    check('A soaked sponge drinks water but freezes', toolFactor(sponge, 0) < .4 && toolFactor(sponge, 1) > 1.5);
    check('Spoons are easier with ice', toolFactor(spoon, 1) > 1.2);
    enemies = [roll]; const w0 = roll.storedWater || 0, hp0 = roll.hp; damageEnemy(roll, 17, 1, 0, 0, 1, 0, false);
    check('Squirting the paper towel waters it', roll.storedWater > w0 && hp0 - roll.hp < 5);
    check('A resisted hit greys the hit marker', hitF < .7);
    damageEnemy(roll, 1, 1, 0, 0, 1, 2, false);
    check('An effective hit gilds the hit marker', hitF > 1.2);
    const hp1 = roll.hp; damageEnemy(roll, 17, 1, 0, 0, 1, 2, false);
    check('Kitchen sources ignore tool factors', (damageEnemy(roll, 10, 0, 1, 0, 0, 2, false, 'HOTPLATE'), true) && hp1 - roll.hp > 17 * 1.5);

    // The Fork is armoured until a dodged final stab sticks it in the counter.
    fresh(); wave = 7; const fork = makeEnemy('fork', P.x + 30, P.z); fork.spawnT = 0; enemies = [fork];
    check('A flying Fork shrugs off the Squirter', toolFactor(fork, 0) < .4);
    fork.y = 1; fork.state = 2; fork.stT = 0; fork.stabs = 2; updateEnemies(1 / 60);
    check('A missed final stab sticks the Fork in the counter', fork.stuck > 0);
    check('A stuck Fork is vulnerable to everything', toolFactor(fork, 0) > 2 && toolFactor(fork, 1) > 2);
    const fx = fork.x; for (let i = 0; i < 30; i++) updateEnemies(1 / 60);
    check('A stuck Fork stays put', Math.abs(fork.x - fx) < .01);
    for (let i = 0; i < 150; i++) updateEnemies(1 / 60);
    check('The Fork pulls itself free again', !(fork.stuck > 0));

    // You cannot hug a puddle.
    fresh(); const hugger = makeEnemy('sponge', P.x + .5, P.z); hugger.spawnT = 0; enemies = [hugger];
    P.latch = hugger; P.latchT = .8; P.onG = true; keys.KeyC = true; updatePlayer(1 / 60); keys.KeyC = false;
    check('Becoming a puddle slips out of a hug', !P.latch && P.latchT <= 0 && P.iT >= .7 && P.pud);

    // The golden sponge outruns walking but leaves water to surf on.
    fresh(); stains.length = 0; const goldBefore = 0; spawnEnemy('gold'); const gold = enemies.find(e => e.gold);
    check('The golden sponge is faster than walking and slower than a wet slide', gold && gold.speed > 11.5 && gold.speed < 24);
    gold.y = 0; gold.spawnT = 0; for (let i = 0; i < 60; i++) updateEnemies(1 / 60);
    check('The golden sponge leaves a wet trail', stains.slice(goldBefore).some(s => s.water));

    // Variety pays; repetition does not.
    fresh(); for (let i = 0; i < 12; i++) techVariety('squirt');
    check('Twelve identical kills trigger the repetition compulsion', varietyMult < 1);
    for (const t of ['ice', 'fizz', 'soap', 'edge']) techVariety(t);
    check('Four different techniques in a row are dialectical', varietyMult > 1.5);
    check('The kitchen\'s own kills are neutral', techVariety('kitchen') === varietyMult);

    // Grease: only soap cuts it.
    fresh(); const oily = makeEnemy('sponge', P.x + 8, P.z); oily.greasy = true; oily.spawnT = 0; enemies = [oily];
    check('Greasy sponges shed water and ice', toolFactor(oily, 0) < .4 && toolFactor(oily, 1) < .5);
    const sc0 = score; trapInBubble(oily);
    check('A bubble degreases a sponge and still traps it', !oily.greasy && oily.bub > 0 && score > sc0 && toolFactor(oily, 0) === 1);
    fresh(); wave = 6; let greasySeen = 0; for (let i = 0; i < 80; i++) { enemies = []; spawnEnemy('sponge'); if (enemies[0] && enemies[0].greasy) greasySeen++; }
    check('Greasy sponges arrive from the stove onwards', greasySeen > 4 && greasySeen < 40);
    fresh(); wave = 2; greasySeen = 0; for (let i = 0; i < 40; i++) { enemies = []; spawnEnemy('sponge'); if (enemies[0] && enemies[0].greasy) greasySeen++; }
    check('No grease before the stove', greasySeen === 0);

    // Challenges that pay for switching tools.
    fresh(); for (let i = 0; i < 200 && !(chal && chal.k === 'dialectic'); i++) { chal = null; chalStart(); }
    check('The dialectic challenge starts', chal && chal.k === 'dialectic');
    const sc1 = score; techVariety('squirt'); techVariety('squirt'); techVariety('ice');
    check('Repeating a technique does not advance the dialectic', chal && chal.prog === 2);
    techVariety('fizz');
    check('Three different kills complete the dialectic', !chal && score >= sc1 + 2500);
    fresh(); chal = { k: 'coldwar', t: 18, prog: 0 }; for (let i = 0; i < 4; i++) techVariety(i === 1 ? 'squirt' : 'ice');
    check('The Cold War wants ice kills', chal && chal.prog === 3); techVariety('ice');
    check('Four ice kills win the Cold War', !chal);

    // The Clog fights back.
    fresh(); spawnClog(); P.x = DRAIN.x - 12; P.z = DRAIN.z; P.y = 0; globs = []; enemies = [];
    clog.spitT = 0; clog.burpT = 0; updateClog(1 / 60);
    check('The Clog spits hairballs', globs.some(g => g.owner === clog));
    check('The Clog regurgitates greasy sponges', enemies.some(e => e.greasy));
    const pullFrom = (pud, dash) => { P.x = DRAIN.x - 8; P.z = DRAIN.z; P.pud = pud; P.dashT = dash ? .2 : 0; clog.hp = clog.max * .4; clog.spitT = clog.burpT = 99; const x0 = P.x; updateClog(1 / 60); return P.x - x0; };
    const walkPull = pullFrom(false, false), pudPull = pullFrom(true, false), dashPull = pullFrom(false, true);
    check('An angry Clog sucks you towards the drain', walkPull > 0);
    check('Puddles get sucked harder', pudPull > walkPull * 1.5);
    check('Dashing resists the suction', dashPull === 0);
    P.pud = false; P.dashT = 0; P.iT = 0; const hpC = P.hp; P.x = DRAIN.x - clog.r - .3; updateClog(1 / 60);
    check('Touching the Clog hurts and shoves you away', P.hp < hpC && P.vx < 0);
    clog.alive = false; globs = []; enemies = [];

    // Ice freezes, frozen things shatter and slide.
    fresh(); const big = makeEnemy('sponge', P.x + 10, P.z, 2); big.spawnT = 0; big.y = 0; enemies = [big];
    for (let i = 0; i < 7; i++) damageEnemy(big, 10, 1, 0, 0, .5, 1, false);
    check('Enough ice freezes a sponge solid', big.frozen > 0 && big.hp > 0);
    big.vx = big.vz = 0; const fx0 = big.x; for (let i = 0; i < 20; i++) updateEnemies(1 / 60);
    check('A frozen sponge does not walk', Math.abs(big.x - fx0) < .05);
    const kills0 = killCount; while (!big.dead && big.hp > 0) damageEnemy(big, 17, 1, 0, 0, 1, 0, false);
    check('Hitting a frozen sponge shatters it before it is worn down', big.dead && big.shattered && killCount === kills0 + 1);
    fresh(); const puck = makeEnemy('sponge', P.x + 10, P.z, 1), pin = makeEnemy('sponge', P.x + 13, P.z, 1); puck.spawnT = pin.spawnT = 0; puck.y = pin.y = 0; enemies = [puck, pin];
    freezeEnemy(puck); puck.vx = 16; const pinHp = pin.hp; for (let i = 0; i < 20 && !pin.dead; i++) updateEnemies(1 / 60);
    check('A sliding frozen sponge bowls over another (curling)', pin.dead || pin.hp < pinHp);
    fresh(); const icy = makeEnemy('sponge', P.x + 6, P.z, 1); icy.spawnT = 0; enemies = [icy]; P.latch = icy; P.latchT = .8; freezeEnemy(icy);
    check('Freezing a hugging sponge frees you', !P.latch);
    check('The gold sponge, the roll and the Fork cannot be frozen', !freezable(makeEnemy('roll', 0, 0)) && !freezable(makeEnemy('fork', 0, 0)) && !freezable(Object.assign(makeEnemy('sponge', 0, 0), { gold: true })));
    for (let i = 0; i < 300; i++) updateEnemies(1 / 60);
    check('Frozen things thaw', !(icy.frozen > 0));

    // The greasy counter: everything slides, every sponge is greasy, puddles surf.
    fresh(); MOD = 'grease'; wave = 8; enemies = []; spawnEnemy('sponge');
    check('On a greasy counter every sponge arrives greasy', enemies[0] && enemies[0].greasy);
    const skate = () => { P.vx = 0; P.vz = 0; P.onG = true; P.pud = false; P.dashT = 0; P.dashCd = 9; keys.KeyW = true; updatePlayer(1 / 60); keys.KeyW = false; return Math.hypot(P.vx, P.vz); };
    const greasyStart = skate(); MOD = null; const dryStart = skate();
    check('Grease turns walking into skating', greasyStart < dryStart * .4);
    MOD = null;

    // Speech: sentence by sentence, with intonation, readable text.
    const plan = speechPlan('Look! This is pure ideology. Why do you squirt the paper towel? And so on, and so on', 0.62, 1.2);
    check('Speech is split into sentences', plan.length === 4 && plan[0].t === 'Look!');
    check('Questions rise and exclamations lift above statements', plan[2].p > plan[1].p + .1 && plan[0].p > plan[1].p + .1);
    check('Speech text drops stage directions and spelled-out shouting', speechText('*sniff* ENJOY · Žižek says', false) === 'enjoy, Zhizhek says');
    check('A Slavic voice keeps the háček', speechText('Žižek', true) === 'Žižek');

    // Stashes that need a particular ability.
    fresh(); chapter = 1; pickups = []; districtSupplies(); const letters = pickups.filter(k => k.stash === 'letter');
    check('Dead letters wait under the low board', letters.length === 3 && letters.every(k => k.y < .95 && Math.abs(k.z - 11) < .1));
    P.x = 74; P.z = 6.4; P.y = 0; P.vx = 0; P.vz = 9; P.onG = true; P.pud = false; for (let i = 0; i < 20; i++) { P.vz = 9; collide(P, PRAD, 1.2); P.z += 9 / 60; }
    check('A standing drop cannot walk under the board', P.z < 7.2);
    fresh(); chapter = 3; pickups = []; districtSupplies(); const shelf = pickups.filter(k => k.stash === 'shelf');
    check('The top shelf stash sits above jumping height', shelf.length === 3 && groundAt(226, 4, 30) > 9 && groundAt(226, 4, 30) - 4.95 > 13.5 * 13.5 / (2 * GRAV));
    const s0 = score; P.x = shelf[0].x; P.y = shelf[0].y - .5; P.z = shelf[0].z; updatePickups(1 / 60);
    check('Reaching a stash pays a bonus', score >= s0 + 1500);
  } catch (e) { out.push('FAIL ' + e.message); }
  finally { window.setTimeout = oldTimer; fresh(); }
  return out;
}
