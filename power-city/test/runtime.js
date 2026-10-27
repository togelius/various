/* Real simulation regression checks. Rendering is stubbed, combat is not.
 * node power-city/test/runtime.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
const noop = () => {};
const ctx = new Proxy({}, { get: () => noop, set: () => true });
const S = { console, Math, Date, JSON, Uint8ClampedArray, setInterval: noop, setTimeout: noop,
  addEventListener: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop,
  navigator: { getGamepads: () => [] }, localStorage: { getItem: () => null, setItem: noop },
  document: { createElement: () => ({ getContext: () => ctx }), getElementById: () => null, addEventListener: noop }
};
S.window = S; vm.createContext(S);
const order = ['core','art','rig','cast','city','audio','music','fx','actors','items','player','enemies','stages','hud','game'];
for (const n of order) vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),S,{filename:n+'.js'});
const P=S.PC, W=P.world, G=P.game;
P.audio = new Proxy({}, {get:()=>noop});
for (const n of ['makeSky','build','buildFront']) P.city[n]=()=>({});
P.city.makeClouds=()=>[];
let checks=0;
function ok(v,label){ assert.ok(v,label); checks++; }
function fresh(seed=19){
  P.rand=P.RNG(seed); G.credits=1; G.startGame(0); G.setState('play');
  W.actors=W.actors.filter(a=>a.team===0); P.stage.active=null; P.stage.pending=[];
  P.input._down={}; P.input._edge={}; P.input._latch={};
  for(const i of P.input.p) for(const k of ['held','pressed','released']) i[k]={};
  return G.players[0];
}
function keys(v){P.input._down=v;}
function step(n=1){for(let i=0;i<n;i++)G.update();}
function arena(){const p=fresh();P.stage.encIndex=99;p.x=150;p.y=205;return p;}
function enemy(type,x,y=205){return P.spawnEnemy(type,x,y,{facing:-1});}

let p=arena(), e=enemy('punk',190);
keys({KeyZ:true});step(200);
ok(e.dead,'holding Attack completes the combo and defeats a nearby punk');
ok(p.hp>=90,'the first opponent is a forgiving introduction');

p=arena();e=enemy('rough',190);e.setState('guard');e.guardT=100;
keys({KeyZ:true});step(55);
ok(e.hp<e.maxHp,'holding Attack adapts to a guard instead of endlessly clinking');

p=arena();e=enemy('brute',170);e.doGrab(p);
P.input._edge.KeyX=true;keys({KeyX:true});step();
ok(!p.grabbedBy && !e.grabbing,'Breakout releases both sides of a bear hug');
ok(p.atk===P.MOVES.spin && p.power<2,'Breakout works while held and spends the meter');
ok(p.invuln>0,'Breakout protects its startup');

p=arena();p.power=0;P.input._edge.KeyX=true;keys({KeyX:true});step();
ok(p.atk!==P.MOVES.spin,'an empty meter cannot secretly launch Breakout');
keys({});step(245);ok(p.power===100,'Breakout recharges without needing combat');

p=arena();P.input._edge.Space=true;keys({Space:true});step(8);
ok(p.airAttacked && p.atk===P.MOVES.jumpKick,'one Jump press launches a flying kick without another button');

p=arena();e=enemy('punk',185);e.invuln=100;p.x=150;p.facing=1;
p.startAttack(P.MOVES.hook);p.atkT=P.MOVES.hook.startup;W.hitstop=5;
P.input._edge.KeyZ=true;keys({KeyZ:true});step();keys({});step(6);
ok(p.buffer.punch>0 || p.queued.punch,'a press during hit-stop survives into recovery');

p=arena();p.x=150;P.stage.timeLeft=1;P.stage.timeT=59;step(180);
ok(p.hp===100 && P.stage.timeLeft===0,'bonus time expiry never injures the player');

p=arena();e=enemy('crusher',240);e.startAttack(P.ENEMY_MOVES.charge);const x=e.x;
for(let i=0;i<20;i++) e.update();
ok(e.x===x,'a charge holds still through its visible wind-up');
for(let i=0;i<20;i++) e.update();
ok(e.x<x-20,'a charge travels during the active attack');

p=arena();e=enemy('crusher',210);e.startAttack(P.ENEMY_MOVES.charge);e.atkT=12;
const bossHp=e.hp, resistance=e.knockRes;
p.startAttack(P.MOVES.jab);p.land(e,P.MOVES.jab);
ok(e.hp<bossHp && e.atk===P.ENEMY_MOVES.charge,'ordinary attacks damage but do not cancel a committed boss charge');
p.startAttack(P.MOVES.spin);p.land(e,P.MOVES.spin);
ok(e.state==='fall' && !e.atk,'Breakout interrupts a committed boss charge');
ok(e.knockRes===resistance,'Breakout does not permanently change boss defenses');

p=arena();e=enemy('crusher',250);e.startAttack(P.ENEMY_MOVES.charge);p.y=P.FLOOR_TOP;
const safeHp=p.hp;
for(let i=0;i<58;i++)e.update();
ok(p.hp===safeHp,'stepping outside the charge lane avoids damage');

p=arena();G.credits=1;G.joinPlayer(1);const p2=G.players[1];p2.x=p.x;p2.y=p.y;
W.separate();ok(p.x===p2.x,'partners can pass through each other');
P.stage.cleared=true;P.stage.finishT=45;step();
ok(G.state==='clear','defeating the boss clears the stage without a long empty walk');

p=arena();const food=P.items.spawn('pickup','heart',p.x,p.y);
ok(P.items.nearest(p,25)!==food,'a held Attack cannot waste food at full health');
p.hp=60;P.items.update();ok(food.dead && p.hp>60,'food still collects when the player needs it');

// Props must be usable in the crowd where they spawn, even while armed.
p=arena();let drum=P.items.spawn('prop','drum',p.x+27,p.y+5);
e=enemy('punk',p.x-24);e.control=noop;e.setState('idle');
keys({KeyZ:true});step();
ok(p.carry===drum && drum.held===p,'Attack lifts a nearby drum despite a close foe and forgiving alignment');
W.actors=W.actors.filter(a=>a.team===0);
step(35);ok(p.carry===drum && !drum.flying,'holding Attack never instantly throws the newly lifted prop');
const carryingX=p.x;keys({KeyZ:true,KeyD:true});step(12);
ok(p.carry===drum && p.x>carryingX+10,'the player can carry a prop while still holding Attack');
keys({});step();keys({KeyZ:true});step();
ok(!p.carry && !drum.held && drum.flying && drum.thrower===p,'a second Attack press throws the carried drum');

p=arena();const bat=P.items.spawn('weapon','bat',p.x,p.y);P.items.take(p,bat);
drum=P.items.spawn('prop','drum',p.x+14,p.y);
keys({KeyZ:true});step();
ok(p.carry===drum && !p.weapon && !bat.held && !bat.dead,'lifting a drum sets down an existing weapon safely');

p=arena();drum=P.items.spawn('prop','drum',p.x,p.y);
const p2item=P.items.spawn('weapon','knife',p.x+1,p.y);P.items.take(p,p2item);
ok(P.items.nearest(p,P.items.pickupRange)===drum,'a held weapon does not mask the nearby drum');
P.items.take(p,drum);G.credits=1;G.joinPlayer(1);
ok(P.items.nearest(G.players[1],P.items.pickupRange)!==drum,'a co-op partner cannot take an already held drum');

p=arena();drum=P.items.spawn('prop','drum',p.x+70,p.y);
keys({KeyZ:true});step();ok(!p.carry,'Attack cannot pick up a drum from across the street');
p=arena();drum=P.items.spawn('prop','drum',p.x,p.y);drum.flying=true;
ok(P.items.nearest(p,P.items.pickupRange)!==drum,'flying drums are not presented as pickups');
drum.flying=false;drum.dead=true;
ok(P.items.nearest(p,P.items.pickupRange)!==drum,'destroyed drums are not presented as pickups');

p=arena();P.stage.timeLeft=99;G.stageClear();const beforeBonus=p.score;
step(105);ok(p.score-beforeBonus===9900,'the shorter stage-clear sequence pays the complete time bonus');
G.setState('ending');step(901);ok(G.state==='ending','the rescue ending waits for the player instead of disappearing');
P.input._edge.Enter=true;keys({Enter:true});step();
ok(G.state==='ready' && G.stageIndex===0 && G.scores[0]===0,'Start begins a fresh run from the ending');

// Beginner controller: approach, hold Attack, use Breakout in a crowd. The
// controller has no private damage, teleport, healing, or enemy removal powers.
function campaign(seed,coop){
  p=fresh(seed); if(coop){G.credits=1;G.joinPlayer(1);}
  let continues=0, last=0, finished=false;
  for(let frame=0;frame<72000;frame++){
    const down={};
    if(G.state==='continue'){G.startPressed(0);continues++;if(continues>8)break;}
    for(let i=0;i<(coop?2:1);i++){
      const a=G.players[i];if(!a||a.dead)continue;
      const es=W.enemies().filter(t=>!['fall','down','getup'].includes(t.state));
      es.sort((b,c)=>(Math.abs(b.x-a.x)+2*Math.abs(b.y-a.y))-(Math.abs(c.x-a.x)+2*Math.abs(c.y-a.y)));
      const t=es[0], map=i?['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Comma','Period']:['KeyA','KeyD','KeyW','KeyS','KeyZ','KeyX'];
      if(t){
        if(Math.abs(t.x-a.x)>38)down[map[t.x>a.x?1:0]]=true;
        if(Math.abs(t.y-a.y)>9)down[map[t.y>a.y?3:2]]=true;
        // A carried prop is thrown with a second press, just like the prompt.
        if(!a.carry || !P.input.p[i].held.punch) down[map[4]]=true;
        if(a.power>=100&&(es.filter(b=>Math.abs(b.x-a.x)<80&&Math.abs(b.y-a.y)<35).length>1||a.state==='held'))down[map[5]]=true;
      } else if(!P.stage.locked)down[map[1]]=true;
    }
    keys(down);step();
    if(G.state==='ending'){finished=true;last=frame;break;}
  }
  ok(finished,'beginner campaign reaches the ending, seed '+seed+(coop?' co-op':''));
  console.log(JSON.stringify({seed,coop,seconds:Math.round(last/60),continues,score:G.scores,remainingLives:G.lives}));
}
for(const seed of [7,19,41])campaign(seed,false);
campaign(19,true);
console.log(checks+' runtime checks passed');
