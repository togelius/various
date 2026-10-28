(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StortorgetReport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function buildReport(game) {
    const towerRows = Object.values(game.levels.TOWER_TYPES).map((definition) => {
      const type = definition.id;
      const damage = game.stats.damageByType[type] || 0;
      const spent = game.stats.spentByType[type] || 0;
      return {
        type,
        name: definition.name,
        damage,
        shots: game.stats.shotsByType[type] || 0,
        spent,
        efficiency: spent > 0 ? damage / spent : 0,
        count: game.towers.filter((tower) => tower.type === type).length,
      };
    }).filter((row) => row.spent > 0 || row.count > 0);

    const mostDamage = [...towerRows].sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name))[0] || null;
    const bestValue = [...towerRows]
      .filter((row) => row.damage > 0 && row.spent > 0)
      .sort((a, b) => b.efficiency - a.efficiency || b.damage - a.damage)[0] || null;
    const totalSpent = towerRows.reduce((sum, row) => sum + row.spent, 0);
    const dominantRow = [...towerRows].sort((a, b) => b.spent - a.spent)[0] || null;

    const routeMap = new Map();
    for (const leak of game.history.leaks) {
      if (!routeMap.has(leak.routeId)) routeMap.set(leak.routeId, { routeId: leak.routeId, count: 0, damage: 0 });
      const route = routeMap.get(leak.routeId);
      route.count += 1;
      route.damage += leak.damage;
    }
    const leakRoutes = [...routeMap.values()].map((route) => ({
      ...route,
      name: game.getRoute(route.routeId)?.name || route.routeId,
    })).sort((a, b) => b.damage - a.damage || b.count - a.count);

    const hardestWave = [...game.history.waves].sort((a, b) => b.leakDamage - a.leakDamage
      || Number(b.outcome === "lost") - Number(a.outcome === "lost")
      || b.wave - a.wave)[0] || null;

    return {
      towerRows,
      mostDamage,
      bestValue,
      dominantType: dominantRow?.type || null,
      dominantName: dominantRow?.name || null,
      dominantShare: dominantRow && totalSpent > 0 ? dominantRow.spent / totalSpent : 0,
      topLeakRoute: leakRoutes[0] || null,
      leakRoutes,
      hardestWave,
      waves: game.history.waves.map((wave) => ({ ...wave })),
      killPoints: game.history.kills.map((point) => ({ ...point })),
      leakPoints: game.history.leaks.map((point) => ({ ...point })),
      bestStreak: game.stats.bestStreak,
      bossKills: game.stats.bossKills,
      bossPhases: game.stats.bossPhases,
    };
  }

  return { buildReport };
});
