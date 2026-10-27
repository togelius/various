#!/usr/bin/env node
"use strict";

const { PERSONAS, SCENARIOS, runPersona } = require("./personas.js");
const { MODES } = require("../js/levels.js");

const MODE_IDS = ["classic", ...Object.keys(MODES)];

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function aggregate(results) {
  const spentByType = {};
  const usedByType = {};
  for (const result of results) {
    for (const [type, spent] of Object.entries(result.spentByType)) {
      spentByType[type] = (spentByType[type] || 0) + spent;
      usedByType[type] = (usedByType[type] || 0) + (spent > 0 ? 1 : 0);
    }
  }
  const totalSpent = Object.values(spentByType).reduce((sum, value) => sum + value, 0);
  const leadingType = Object.entries(spentByType).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    games: results.length,
    wins: results.filter((result) => result.outcome === "won").length,
    winRate: results.length ? results.filter((result) => result.outcome === "won").length / results.length : 0,
    averageWave: round(mean(results.map((result) => result.reachedWave)), 2),
    averageHealth: round(mean(results.map((result) => result.health)), 2),
    averageKills: round(mean(results.map((result) => result.kills)), 1),
    averageLeaks: round(mean(results.map((result) => result.leaks)), 2),
    averageLeakDamage: round(mean(results.map((result) => result.leakDamage)), 2),
    averageFikaUses: round(mean(results.map((result) => result.fikaUses)), 2),
    averageEarlyBonus: round(mean(results.map((result) => result.earlyBonus)), 1),
    averageElapsed: round(mean(results.map((result) => result.elapsed)), 1),
    averageTowers: round(mean(results.map((result) => result.towerCount)), 2),
    outcomes: Object.fromEntries(["won", "lost", "timeout"].map((outcome) => [outcome, results.filter((result) => result.outcome === outcome).length])),
    spentByType,
    usedByType,
    leadingType: leadingType ? leadingType[0] : null,
    leadingSpendShare: leadingType && totalSpent ? round(leadingType[1] / totalSpent, 3) : 0,
  };
}

function groupBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function waveSummaries(results) {
  const summaries = {};
  for (const [scenario, scenarioResults] of groupBy(results, (result) => result.scenario)) {
    const waveNumbers = new Set(scenarioResults.flatMap((result) => result.perWave.map((wave) => wave.wave)));
    summaries[scenario] = [...waveNumbers].sort((a, b) => a - b).map((waveNumber) => {
      const records = scenarioResults.flatMap((result) => result.perWave.filter((wave) => wave.wave === waveNumber));
      return {
        wave: waveNumber,
        observations: records.length,
        losses: records.filter((wave) => wave.outcome === "lost").length,
        averageLeaks: round(mean(records.map((wave) => wave.leaks)), 2),
        averageLeakDamage: round(mean(records.map((wave) => wave.leakDamage)), 2),
        averageKills: round(mean(records.map((wave) => wave.kills)), 2),
        clearRate: records.length ? round(records.filter((wave) => wave.outcome === "cleared").length / records.length, 3) : 0,
      };
    });
  }
  return summaries;
}

function makeFindings(results, summary) {
  const findings = [];
  for (const [scenario, waves] of Object.entries(summary.waves)) {
    const ranked = waves.filter((wave) => wave.averageLeakDamage > 0 || wave.losses > 0).sort((a, b) => (
      (b.averageLeakDamage + b.losses * 2) - (a.averageLeakDamage + a.losses * 2) || a.wave - b.wave
    ));
    for (const wave of ranked.slice(0, 2)) {
      findings.push({
        kind: "wave-spike",
        scenario,
        wave: wave.wave,
        averageLeakDamage: wave.averageLeakDamage,
        losses: wave.losses,
        message: `${scenario} wave ${wave.wave}: ${wave.averageLeakDamage} average leak damage, ${wave.losses} loss(es) in ${wave.observations} observed run(s).`,
      });
    }
  }

  const usage = aggregate(results);
  if (usage.leadingType && usage.leadingSpendShare >= 0.45) {
    findings.push({
      kind: "tower-dominance",
      type: usage.leadingType,
      share: usage.leadingSpendShare,
      message: `${usage.leadingType} receives ${Math.round(usage.leadingSpendShare * 100)}% of all simulated spending; check whether alternatives have useful niches.`,
    });
  }
  for (const type of Object.keys(canonicalTowerTypes(results))) {
    if (!usage.usedByType[type]) {
      findings.push({
        kind: "unused-tower",
        type,
        message: `${type} received no spending in this matrix; its utility or persona coverage may need investigation.`,
      });
    }
  }

  for (const [persona, stats] of Object.entries(summary.personas)) {
    if (stats.games && stats.averageWave <= 2) {
      findings.push({
        kind: "opening-wall",
        persona,
        averageWave: stats.averageWave,
        message: `${persona} averages only wave ${stats.averageWave}; inspect the opening economy and coverage.`,
      });
    }
  }
  if (!findings.length) {
    findings.push({ kind: "no-spike", message: "No leak spike, opening wall, unused tower, or >45% spending concentration was detected by these heuristics." });
  }
  return findings;
}

function canonicalTowerTypes(results) {
  return results.length ? results[0].spentByType : {};
}

function summarize(results) {
  const personas = {};
  for (const persona of PERSONAS) {
    const matching = results.filter((result) => result.persona === persona.id);
    if (matching.length) personas[persona.id] = aggregate(matching);
  }
  const scenarios = {};
  for (const scenario of SCENARIOS) {
    const matching = results.filter((result) => result.scenario === scenario.id);
    if (matching.length) scenarios[scenario.id] = aggregate(matching);
  }
  const cells = {};
  for (const [key, matching] of groupBy(results, (result) => `${result.scenario}:${result.persona}`)) {
    cells[key] = aggregate(matching);
  }
  const summary = {
    overall: aggregate(results),
    personas,
    scenarios,
    cells,
    waves: waveSummaries(results),
  };
  summary.findings = makeFindings(results, summary);
  return summary;
}

function runMatrix(options = {}) {
  const personaIds = options.persona ? [options.persona] : PERSONAS.map((persona) => persona.id);
  const scenarioIds = options.scenario ? [options.scenario] : SCENARIOS.map((scenario) => scenario.id);
  const seed = options.seed ?? 7;
  const repetitions = options.deep ? 3 : 1;
  const mode = options.mode && options.mode !== "classic" ? options.mode : null;
  const results = [];
  for (const scenario of scenarioIds) {
    for (const persona of personaIds) {
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        results.push(runPersona(persona, { scenario, seed: seed + repetition, mode }));
      }
    }
  }
  return results;
}

function pad(value, width, right = false) {
  const text = String(value);
  return right ? text.padStart(width) : text.padEnd(width);
}

function statsRow(label, stats) {
  const lead = stats.leadingType ? `${stats.leadingType} ${Math.round(stats.leadingSpendShare * 100)}%` : "-";
  return [
    pad(label, 12),
    pad(`${Math.round(stats.winRate * 100)}%`, 6, true),
    pad(stats.averageWave, 6, true),
    pad(stats.averageHealth, 6, true),
    pad(stats.averageLeaks, 7, true),
    pad(stats.averageFikaUses, 6, true),
    pad(stats.averageEarlyBonus, 7, true),
    pad(lead, 16, true),
  ].join(" ");
}

function formatHuman(results, summary, options) {
  const lines = [];
  const personaCount = new Set(results.map((result) => result.persona)).size;
  const scenarioCount = new Set(results.map((result) => result.scenario)).size;
  const repetitions = options.deep ? 3 : 1;
  lines.push(`Balance lab [${options.mode || "classic"}]: ${results.length} games | ${personaCount} persona(s) × ${scenarioCount} scenario(s) × ${repetitions} seed(s) | base seed ${options.seed ?? 7}`);
  lines.push("Win rates are simulation outcomes, not estimates of human success or enjoyment.");
  lines.push("");
  lines.push("Overall by persona");
  lines.push(`${pad("Persona", 12)} ${pad("Win", 6, true)} ${pad("Wave", 6, true)} ${pad("HP", 6, true)} ${pad("Leaks", 7, true)} ${pad("Fika", 6, true)} ${pad("Early", 7, true)} ${pad("Leading spend", 16, true)}`);
  for (const [persona, stats] of Object.entries(summary.personas)) lines.push(statsRow(persona, stats));

  for (const scenario of SCENARIOS) {
    const matching = results.filter((result) => result.scenario === scenario.id);
    if (!matching.length) continue;
    lines.push("");
    lines.push(`${scenario.name} [${scenario.id}] — ${scenario.description}`);
    lines.push(`${pad("Persona", 12)} ${pad("Win", 6, true)} ${pad("Wave", 6, true)} ${pad("HP", 6, true)} ${pad("Leaks", 7, true)} ${pad("Fika", 6, true)} ${pad("Early", 7, true)} ${pad("Leading spend", 16, true)}`);
    for (const persona of PERSONAS) {
      const key = `${scenario.id}:${persona.id}`;
      if (summary.cells[key]) lines.push(statsRow(persona.id, summary.cells[key]));
    }
  }

  lines.push("");
  lines.push("Notable findings");
  for (const finding of summary.findings) lines.push(`- ${finding.message}`);
  return `${lines.join("\n")}\n`;
}

function usage() {
  return `Usage: node tools/balance-lab.js [options]\n\nOptions:\n  --deep             Run three deterministic seeds per persona/scenario cell\n  --json             Emit machine-readable results and aggregates\n  --persona <id>     Limit to one persona (${PERSONAS.map((persona) => persona.id).join(", ")})\n  --scenario <id>    Limit to one scenario (${SCENARIOS.map((scenario) => scenario.id).join(", ")})\n  --seed <n>         Base integer seed (default: 7)\n  --mode <id>        Rule set: ${MODE_IDS.join(", ")} (default: classic)\n  --help             Show this help\n`;
}

function parseArguments(argv) {
  const options = { deep: false, json: false, seed: 7 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--deep") options.deep = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (["--persona", "--scenario", "--seed", "--mode"].includes(argument)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--persona") {
        if (!PERSONAS.some((persona) => persona.id === value)) throw new Error(`Unknown persona: ${value}`);
        options.persona = value;
      } else if (argument === "--mode") {
        if (!MODE_IDS.includes(value)) throw new Error(`Unknown mode: ${value}`);
        options.mode = value;
      } else if (argument === "--scenario") {
        if (!SCENARIOS.some((scenario) => scenario.id === value)) throw new Error(`Unknown scenario: ${value}`);
        options.scenario = value;
      } else {
        if (!/^-?\d+$/.test(value)) throw new Error("--seed requires an integer");
        options.seed = Number(value);
      }
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}`);
    process.exitCode = 1;
    return;
  }
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const results = runMatrix(options);
  const summary = summarize(results);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ options, runs: results, summary }, null, 2)}\n`);
  } else {
    process.stdout.write(formatHuman(results, summary, options));
  }
}

if (require.main === module) main();

module.exports = { runMatrix, summarize, aggregate, formatHuman, parseArguments };
