/* POWER CITY - read the agents' ledgers and print what the machines think.
 * usage: node tools/analyze.js <dir> */
'use strict';
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || '/tmp/pc-agents';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const runs = files.map(f => ({ name: f.replace(/\.json$/, ''), s: JSON.parse(fs.readFileSync(path.join(dir, f))) }));

// ---------------------------------------------------------------- helpers
function pct(a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '-'; }
function sum(o, keys) { return keys.reduce((t, k) => t + (o[k] || 0), 0); }
const FLOOR_STATES = ['fall', 'down', 'getup'];

function analyze(s, name) {
  const play = s.playFrames || 1;
  const floor = sum(s.pStates, FLOOR_STATES);
  const enFrames = sum(s.eStates, Object.keys(s.eStates));
  const out = {
    name,
    result: s.result, frames: s.frames, play: s.playFrames,
    mins: +(play / 3600).toFixed(1),
    score: s.score, kills: s.kills, deaths: s.deaths, cont: s.continues, timeouts: s.timeouts,
    hitsTaken: s.taken.count, dmgTaken: Math.round(s.taken.dmg),
    hitsDealt: s.dealt.count, dmgDealt: Math.round(s.dealt.dmg),
    floorPct: pct(floor, play),
    hurtPct: pct(s.pStates.hurt || 0, play),
    fromBehindPct: pct(s.cheap.fromBehind, s.taken.count),
    postGetup: s.cheap.postGetup,
    knockdownsTaken: s.cheap.knockdowns, knockdownsDealt: s.knockdownsDealt,
    kdPerMin: +(s.cheap.knockdowns / (play / 3600)).toFixed(1),
    hitsPerSec: +(s.dealt.count / (play / 60)).toFixed(2),
    enemy: {
      walkPct: pct(s.eStates.walk || 0, enFrames),
      attackPct: pct(s.eStates.attack || 0, enFrames),
      idlePct: pct(s.eStates.idle || 0, enFrames),
      hurtPct: pct(s.eStates.hurt || 0, enFrames),
      dizzyPct: pct(s.eStates.dizzy || 0, enFrames),
      floorPct: pct(sum(s.eStates, FLOOR_STATES), enFrames)
    },
    downtimePct: pct(s.downtime, play),
    hitstopPct: pct(s.hitstop, play),
    tokenSatPct: pct(s.tokenSat, play),
    avgEnemies: s.avgEnemies, maxEnemies: s.maxEnemies,
    grabs: { made: s.grabsMade, taken: s.grabsTaken, throws: s.throws, knees: s.knees },
    items: s.items, takenByMove: s.takenByMove,
    encs: (s.encounters || []).map(e => ({
      st: e.stage, i: e.enc, f: e.frames, sec: +(e.frames / 60).toFixed(1),
      en: e.enemies, d: e.deaths, hp0: e.hpStart, hp1: e.hpEnd, boss: e.boss
    })),
    bosses: s.bossFights,
    moves: s.moves,
    softlocks: s.softlocks,
    deathsAt: s.deathsAt
  };
  return out;
}

// ------------------------------------------------------------------ report
console.log('=== POWER CITY agent testing report ===\n');
for (const r of runs) {
  const a = analyze(r.s, r.name);
  console.log(`\n--- ${a.name} ---`);
  console.log(`result=${a.result} play=${a.mins}min score=${a.score} kills=${a.kills} deaths=${a.deaths} continues=${a.cont} timeouts=${a.timeouts}`);
  console.log(`dealt ${a.hitsDealt} hits/${a.dmgDealt} dmg (${a.hitsPerSec}/s) | took ${a.hitsTaken} hits/${a.dmgTaken} dmg`);
  console.log(`player on floor ${a.floorPct} of play, hurt ${a.hurtPct}, fromBehind ${a.fromBehindPct}, postGetup hits ${a.postGetup}`);
  console.log(`knockdowns: took ${a.knockdownsTaken} (${a.kdPerMin}/min) dealt ${a.knockdownsDealt}`);
  console.log(`enemies: walk ${a.enemy.walkPct} attack ${a.enemy.attackPct} idle ${a.enemy.idlePct} hurt ${a.enemy.hurtPct} dizzy ${a.enemy.dizzyPct} floor ${a.enemy.floorPct}`);
  console.log(`downtime ${a.downtimePct} | hitstop ${a.hitstopPct} | tokenSat ${a.tokenSatPct} | avgEnemies ${a.avgEnemies}`);
  console.log(`grabs made=${a.grabs.made} throws=${a.grabs.throws} taken=${a.grabs.taken} | items ${JSON.stringify(a.items)}`);
  if (a.bosses.length) console.log('bosses: ' + a.bosses.map(b => `${b.name} ${Math.round(b.frames / 60)}s`).join(', '));
  const tbm = Object.keys(a.takenByMove || {}).sort((x, y) => a.takenByMove[y] - a.takenByMove[x]);
  if (tbm.length) console.log('hit by: ' + tbm.map(k => `${k}:${a.takenByMove[k]}`).join(', '));
  const slow = a.encs.filter(e => e.sec > 45);
  if (slow.length) console.log('slow encounters (>45s): ' + slow.map(e => `s${e.st}e${e.i}:${e.sec}s`).join(', '));
  if (a.softlocks.length) console.log('SOFTLOCKS: ' + JSON.stringify(a.softlocks));
}

// ------------------------------------------------------- cross-run summary
console.log('\n\n=== cross-run summary ===');
function agg(persona) {
  const rs = runs.filter(r => r.name.startsWith(persona + '-'));
  if (!rs.length) return;
  const deaths = rs.reduce((t, r) => t + r.s.deaths, 0);
  const timeouts = rs.reduce((t, r) => t + r.s.timeouts, 0);
  const taken = rs.reduce((t, r) => t + r.s.taken.count, 0);
  const behind = rs.reduce((t, r) => t + (r.s.cheap.fromBehind || 0), 0);
  const kd = rs.reduce((t, r) => t + (r.s.cheap.knockdowns || 0), 0);
  const play = rs.reduce((t, r) => t + (r.s.playFrames || 0), 0);
  const floor = rs.reduce((t, r) => t + (r.s.pStates.fall + r.s.pStates.down + r.s.pStates.getup), 0);
  const dealt = rs.reduce((t, r) => t + r.s.dealt.count, 0);
  console.log(`${persona}: deaths=${deaths} timeouts=${timeouts} hitsTaken=${taken} fromBehind=${pct(behind, taken)} kdTaken=${kd} floorPct=${pct(floor, play)} hits/s=${+(dealt / (play / 60)).toFixed(2)}`);
}
['masher', 'walker', 'brawler', 'runner'].forEach(agg);

// -------------------------------------------------------------- move stats
console.log('\n=== move usage (all runs) ===');
const mv = {};
for (const r of runs) for (const k in r.s.moves) {
  const m = mv[k] || (mv[k] = { starts: 0, hits: 0, dmg: 0 });
  m.starts += r.s.moves[k].starts; m.hits += r.s.moves[k].hits; m.dmg += r.s.moves[k].dmg;
}
const keys = Object.keys(mv).sort((a, b) => mv[b].starts - mv[a].starts);
for (const k of keys) {
  const m = mv[k];
  console.log(`${k.padEnd(14)} starts=${String(m.starts).padStart(5)} hits=${String(m.hits).padStart(5)} land=${pct(m.hits, m.starts).padStart(5)} dmg=${Math.round(m.dmg)}`);
}

// --------------------------------------------------------- death causality
console.log('\n=== what kills the players ===');
const causes = {};
for (const r of runs) for (const d of (r.s.deathsAt || [])) {
  const c = d.cause || {};
  const key = `${c.from || '?'} (${c.state || '?'})`;
  causes[key] = (causes[key] || 0) + 1;
}
Object.keys(causes).sort((a, b) => causes[b] - causes[a]).forEach(k => console.log(`  ${k}: ${causes[k]}`));