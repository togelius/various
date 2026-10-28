(function () {
  "use strict";

  const Game = window.StortorgetEngine.Game;
  const { TEXT, fill } = window.StortorgetText;
  const DANISH = window.StortorgetDanish;
  const MODE_STORAGE_KEY = "stortorget-mode";
  let mode = loadMode();
  let game = new Game({ mode });
  let levels = game.levels;
  let text = TEXT[mode];
  const t = (key, params) => fill(text[key], params);
  const formatMoney = (value) => text.money(value);
  const canvas = document.getElementById("game-canvas");
  const shell = document.getElementById("game-shell");
  const context = canvas.getContext("2d");
  const element = (id) => document.getElementById(id);
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ui = {
    started: false,
    paused: false,
    speed: 1,
    selectedType: null,
    selectedTowerId: null,
    hoveredPadId: null,
    routePreview: Infinity,
    particles: [],
    rings: [],
    floaters: [],
    quips: [],
    quipSchedule: new Map(),
    quipHistory: new Map(),
    hitFlashes: new Map(),
    recoil: new Map(),
    lastDamageNumbers: new Map(),
    shake: 0,
    shakeOffset: { x: 0, y: 0 },
    statueHit: 0,
    endShown: false,
    helpOpen: false,
    pendingMode: mode,
    lastRetortAt: -100,
    lastSlowQuipAt: -100,
    fireworksSpoken: 0,
    routesGreeted: new Set(),
  };

  // Approximate centre line of the canals north of the old town, in map pixels.
  const CANAL = [[110, 0], [125, 50], [150, 95], [200, 105], [260, 100], [330, 82], [400, 70], [503, 52]];
  const CANAL_WIDTH = 20;

  const view = { width: 1, height: 1, dpr: 1, fitScale: 1 };
  const camera = { x: levels.MAP.width / 2, y: levels.MAP.height / 2, scale: 1 };
  let mapReady = false;
  let mapRender = null;
  let lastFrame = 0;
  let accumulator = 0;
  let toastTimer = 0;
  let waveBannerTimer = 0;
  let audioContext = null;
  let masterGain = null;
  let noiseBuffer = null;
  const lastSoundTimes = new Map();
  let soundEnabled = true;

  try {
    soundEnabled = localStorage.getItem("stortorget-sound") !== "off";
  } catch (_) {
    // The game also works with storage disabled (including some file:// modes).
  }

  function loadMode() {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      if (saved && TEXT[saved]) return saved;
    } catch (_) {}
    return /^sv\b/i.test(navigator.language || "") ? "skanska" : "american";
  }

  function saveMode(value) {
    try { localStorage.setItem(MODE_STORAGE_KEY, value); } catch (_) {}
  }

  function readBest(modeId) {
    try { return Number(localStorage.getItem(`stortorget-best-${modeId}`)) || 0; } catch (_) { return 0; }
  }

  // Records waves cleared; returns true when the run sets a new record.
  function recordBest(cleared) {
    if (cleared <= readBest(mode)) return false;
    try { localStorage.setItem(`stortorget-best-${mode}`, String(cleared)); } catch (_) {}
    return true;
  }

  function distanceToCanal(point) {
    let best = Infinity;
    for (let index = 0; index < CANAL.length - 1; index += 1) {
      const [ax, ay] = CANAL[index];
      const [bx, by] = CANAL[index + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const along = clamp(((point.x - ax) * dx + (point.y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      best = Math.min(best, Math.hypot(point.x - (ax + dx * along), point.y - (ay + dy * along)));
    }
    return best;
  }
  function loadMap() {
    const image = new Image();
    image.onload = () => {
      mapRender = document.createElement("canvas");
      mapRender.width = levels.MAP.width;
      mapRender.height = levels.MAP.height;
      const mapContext = mapRender.getContext("2d");
      try {
        mapContext.filter = "saturate(0.72) brightness(0.91)";
      } catch (_) {
        // Canvas filters are cosmetic; the original map is a fine fallback.
      }
      mapContext.drawImage(image, 0, 0);
      mapContext.filter = "none";
      mapContext.fillStyle = "rgba(12, 47, 39, 0.08)";
      mapContext.fillRect(0, 0, mapRender.width, mapRender.height);
      mapReady = true;
    };
    image.onerror = () => {
      element("game-hint").textContent = t("mapError");
    };
    image.src = "assets/malmo-map.png";
  }

  function resize() {
    const bounds = shell.getBoundingClientRect();
    const oldFit = view.fitScale;
    const oldScaleRatio = oldFit > 0 ? camera.scale / oldFit : 1;
    view.width = Math.max(1, bounds.width);
    view.height = Math.max(1, bounds.height);
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(view.width * view.dpr);
    canvas.height = Math.round(view.height * view.dpr);
    view.fitScale = Math.max(0.05, Math.min(
      (view.width - 24) / levels.MAP.width,
      (view.height - 24) / levels.MAP.height,
    ));
    camera.scale = clamp(view.fitScale * oldScaleRatio, view.fitScale * 0.85, view.fitScale * 4);
    clampCamera();
  }

  function fitCamera() {
    camera.x = levels.MAP.width / 2;
    camera.y = levels.MAP.height / 2;
    camera.scale = view.fitScale;
    clampCamera();
  }

  function clampCamera() {
    camera.scale = clamp(camera.scale, view.fitScale * 0.85, view.fitScale * 4);
    const halfWidth = view.width / (2 * camera.scale);
    const halfHeight = view.height / (2 * camera.scale);
    const margin = 55;
    camera.x = halfWidth * 2 >= levels.MAP.width + margin * 2
      ? levels.MAP.width / 2
      : clamp(camera.x, halfWidth - margin, levels.MAP.width - halfWidth + margin);
    camera.y = halfHeight * 2 >= levels.MAP.height + margin * 2
      ? levels.MAP.height / 2
      : clamp(camera.y, halfHeight - margin, levels.MAP.height - halfHeight + margin);
  }

  function worldToScreen(point) {
    return {
      x: (point.x - camera.x) * camera.scale + view.width / 2 + ui.shakeOffset.x,
      y: (point.y - camera.y) * camera.scale + view.height / 2 + ui.shakeOffset.y,
    };
  }

  function screenToWorld(point) {
    return {
      x: (point.x - ui.shakeOffset.x - view.width / 2) / camera.scale + camera.x,
      y: (point.y - ui.shakeOffset.y - view.height / 2) / camera.scale + camera.y,
    };
  }

  function pointFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function zoomAt(point, factor) {
    const anchor = screenToWorld(point);
    camera.scale = clamp(camera.scale * factor, view.fitScale * 0.85, view.fitScale * 4);
    camera.x = anchor.x - (point.x - view.width / 2) / camera.scale;
    camera.y = anchor.y - (point.y - view.height / 2) / camera.scale;
    clampCamera();
  }

  function beginWorldDraw() {
    context.save();
    context.translate(view.width / 2, view.height / 2);
    context.scale(camera.scale, camera.scale);
    context.translate(-camera.x, -camera.y);
  }

  function drawMap(time) {
    context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    context.fillStyle = "#19332d";
    context.fillRect(0, 0, view.width, view.height);
    ui.shakeOffset.x = ui.shake > 0 && !reducedMotion ? Math.sin(time * 91.7) * ui.shake : 0;
    ui.shakeOffset.y = ui.shake > 0 && !reducedMotion ? Math.cos(time * 113.3) * ui.shake * 0.72 : 0;
    context.translate(ui.shakeOffset.x, ui.shakeOffset.y);

    beginWorldDraw();
    context.fillStyle = "#d9ddcf";
    context.fillRect(0, 0, levels.MAP.width, levels.MAP.height);
    if (mapReady) context.drawImage(mapRender, 0, 0);
    context.strokeStyle = "rgba(222, 245, 232, 0.35)";
    context.lineWidth = 1 / camera.scale;
    context.strokeRect(0, 0, levels.MAP.width, levels.MAP.height);

    if (ui.routePreview > 0) drawRoutes(time);
    drawRanges();
    drawSupportAuras();
    context.restore();

    if (!mapReady) {
      context.fillStyle = "#dbe9e2";
      context.font = "600 14px -apple-system, sans-serif";
      context.textAlign = "center";
      context.fillText(t("mapLoading"), view.width / 2, view.height / 2);
    }
  }

  function drawRoutes(time) {
    const active = game.getActiveRoutes();
    for (const routeId of active) {
      const route = game.getRoute(routeId);
      if (!route) continue;
      context.beginPath();
      route.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.strokeStyle = "rgba(9, 27, 24, 0.65)";
      context.lineWidth = 6 / camera.scale;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.setLineDash([]);
      context.stroke();
      context.strokeStyle = route.color;
      context.globalAlpha = 0.83;
      context.lineWidth = 2.7 / camera.scale;
      context.setLineDash([9 / camera.scale, 8 / camera.scale]);
      context.lineDashOffset = reducedMotion ? 0 : -time * 10 / camera.scale;
      context.stroke();
      context.globalAlpha = 1;
      context.setLineDash([]);
    }
  }

  function drawRange(x, y, range, color) {
    context.beginPath();
    context.arc(x, y, range, 0, Math.PI * 2);
    context.fillStyle = color;
    context.globalAlpha = 0.1;
    context.fill();
    context.globalAlpha = 0.72;
    context.strokeStyle = color;
    context.lineWidth = 1.4 / camera.scale;
    context.setLineDash([4 / camera.scale, 4 / camera.scale]);
    context.stroke();
    context.globalAlpha = 1;
    context.setLineDash([]);
  }

  function drawRanges() {
    const tower = game.towers.find((item) => item.id === ui.selectedTowerId);
    if (tower) {
      drawRange(tower.x, tower.y, game.getTowerStats(tower).range, levels.TOWER_TYPES[tower.type].color);
      return;
    }
    if (!ui.selectedType || !ui.hoveredPadId) return;
    const pad = levels.BUILD_PADS.find((item) => item.id === ui.hoveredPadId);
    const occupied = game.towers.some((towerItem) => towerItem.padId === ui.hoveredPadId);
    if (pad && !occupied) {
      drawRange(pad.x, pad.y, levels.TOWER_TYPES[ui.selectedType].range, levels.TOWER_TYPES[ui.selectedType].color);
    }
  }

  function drawSpawnMarkers() {
    const showNames = ui.routePreview > 0;
    for (const routeId of game.getActiveRoutes()) {
      const route = game.getRoute(routeId);
      if (!route) continue;
      const start = worldToScreen(route.points[0]);
      if (start.x < -60 || start.x > view.width + 60 || start.y < -60 || start.y > view.height + 60) continue;
      context.save();
      context.shadowColor = "rgba(0,0,0,.45)";
      context.shadowBlur = 8;
      context.fillStyle = route.color;
      context.beginPath();
      context.arc(start.x, start.y, 7, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = "#14332d";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = "#17352f";
      context.beginPath();
      context.arc(start.x, start.y, 2, 0, Math.PI * 2);
      context.fill();
      if (showNames) {
        const onRight = start.x > view.width * 0.63;
        const labelY = clamp(start.y - 13, 16, view.height - 16);
        context.font = "700 9px -apple-system, sans-serif";
        const width = context.measureText(route.name).width + 12;
        const labelX = onRight ? start.x - width - 10 : start.x + 10;
        context.fillStyle = "rgba(10, 31, 27, 0.88)";
        context.beginPath();
        context.roundRect(labelX, labelY - 10, width, 18, 5);
        context.fill();
        context.fillStyle = "#edf7f2";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(route.name, labelX + 6, labelY - 1);
      }
      context.restore();
    }
  }

  function drawSupportAuras() {
    for (const support of game.towers) {
      if (!levels.TOWER_TYPES[support.type].support) continue;
      const stats = game.getTowerStats(support);
      context.fillStyle = levels.TOWER_TYPES[support.type].color;
      context.globalAlpha = 0.035;
      context.beginPath();
      context.arc(support.x, support.y, stats.range, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 0.16;
      context.strokeStyle = levels.TOWER_TYPES[support.type].color;
      context.lineWidth = 1 / camera.scale;
      for (const ally of game.towers) {
        if (ally.id === support.id || levels.TOWER_TYPES[ally.type].support) continue;
        if (Math.hypot(ally.x - support.x, ally.y - support.y) > stats.range) continue;
        context.beginPath();
        context.moveTo(support.x, support.y);
        context.lineTo(ally.x, ally.y);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  function drawBuildPads(time) {
    for (const pad of levels.BUILD_PADS) {
      if (game.towers.some((tower) => tower.padId === pad.id)) continue;
      const point = worldToScreen(pad);
      if (point.x < -25 || point.x > view.width + 25 || point.y < -25 || point.y > view.height + 25) continue;
      const highlighted = ui.selectedType !== null;
      const hovered = ui.hoveredPadId === pad.id;
      const pulse = reducedMotion ? 0 : Math.sin(time * 3 + pad.x) * 0.7;
      const radius = (highlighted ? 9 : 6.5) + (hovered ? 2 : 0) + (highlighted ? pulse : 0);
      context.save();
      context.shadowColor = "rgba(0,0,0,.35)";
      context.shadowBlur = 5;
      context.fillStyle = highlighted ? "rgba(240, 255, 248, 0.96)" : "rgba(240, 250, 244, 0.76)";
      context.strokeStyle = highlighted ? levels.TOWER_TYPES[ui.selectedType].color : "#52756a";
      context.lineWidth = highlighted ? 2.5 : 1.5;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      context.strokeStyle = "#21493e";
      context.lineWidth = 1.5;
      if (highlighted) {
        context.beginPath();
        context.moveTo(point.x - 3.5, point.y);
        context.lineTo(point.x + 3.5, point.y);
        context.moveTo(point.x, point.y - 3.5);
        context.lineTo(point.x, point.y + 3.5);
        context.stroke();
      } else {
        context.fillStyle = "#365d51";
        context.beginPath();
        context.arc(point.x, point.y, 1.7, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }

  function drawTower(tower) {
    const point = worldToScreen(tower);
    if (point.x < -30 || point.x > view.width + 30 || point.y < -30 || point.y > view.height + 30) return;
    const definition = levels.TOWER_TYPES[tower.type];
    const selected = tower.id === ui.selectedTowerId;
    const recoil = ui.recoil.get(tower.id) || 0;
    const visualScale = clamp(camera.scale, 0.62, 1) * (1 + recoil * 0.35);
    context.save();
    context.translate(point.x, point.y);
    context.scale(visualScale, visualScale);
    context.shadowColor = "rgba(0,0,0,.45)";
    context.shadowBlur = 7;
    context.fillStyle = "#163c34";
    context.beginPath();
    context.arc(0, 1, 14, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = definition.color;
    context.beginPath();
    context.arc(0, 0, 11.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = selected ? "#ffe19a" : "rgba(239,255,247,.85)";
    context.lineWidth = selected ? 3 : 1.5;
    context.stroke();

    if (!definition.support && tower.type !== "vind") {
      context.save();
      context.rotate(tower.angle);
      context.translate(-recoil * 20, 0);
      context.strokeStyle = tower.type === "bulle" ? "#6d3d25" : "#264b41";
      context.lineWidth = tower.type === "bulle" ? 5 : 3;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(4, 0);
      context.lineTo(16, 0);
      context.stroke();
      if (recoil > 0.025) {
        context.globalAlpha = clamp(recoil * 7, 0, 1);
        context.fillStyle = "#fff1ae";
        context.beginPath();
        context.arc(18, 0, tower.type === "bulle" ? 5 : 3, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
      context.restore();
    }

    if (tower.type === "falafel") {
      context.fillStyle = "#f4d18d";
      [[-3, -2], [3, -2], [0, 3]].forEach(([x, y]) => {
        context.beginPath();
        context.arc(x, y, 2.4, 0, Math.PI * 2);
        context.fill();
      });
    } else if (tower.type === "bulle") {
      context.fillStyle = "#713f29";
      context.font = "18px Georgia, serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("◎", 0, 0);
    } else if (tower.type === "glass") {
      context.fillStyle = "#f4fbff";
      context.beginPath();
      context.arc(0, -3, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#e5bd83";
      context.beginPath();
      context.moveTo(-4, 0);
      context.lineTo(4, 0);
      context.lineTo(0, 7);
      context.closePath();
      context.fill();
    } else if (tower.type === "espresso") {
      context.fillStyle = "#fff0d2";
      context.fillRect(-5, -1, 9, 7);
      context.strokeStyle = "#68452e";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(5, 2, 3, -Math.PI / 2, Math.PI / 2);
      context.stroke();
      context.beginPath();
      context.moveTo(-2, -3);
      context.quadraticCurveTo(-4, -6, -1, -8);
      context.moveTo(2, -3);
      context.quadraticCurveTo(0, -6, 3, -8);
      context.stroke();
    } else if (tower.type === "vind") {
      context.save();
      context.rotate(game.elapsed * 4 + tower.id);
      context.fillStyle = "#efffff";
      for (let blade = 0; blade < 3; blade += 1) {
        context.rotate(Math.PI * 2 / 3);
        context.beginPath();
        context.ellipse(4, 0, 5, 2.2, 0.35, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
      context.fillStyle = "#347b78";
      context.beginPath();
      context.arc(0, 0, 2.3, 0, Math.PI * 2);
      context.fill();
    }

    for (let index = 0; index < tower.level; index += 1) {
      context.fillStyle = "#ffe19a";
      context.beginPath();
      context.arc((index - (tower.level - 1) / 2) * 5, 17, 1.7, 0, Math.PI * 2);
      context.fill();
    }
    if (game.getFireRateMultiplier(tower) > 1) {
      context.fillStyle = "#fff0a8";
      context.beginPath();
      context.arc(-11, -11, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawEnemy(enemy) {
    const point = worldToScreen(enemy);
    if (point.x < -35 || point.x > view.width + 35 || point.y < -35 || point.y > view.height + 35) return;
    const definition = levels.ENEMY_TYPES[enemy.type];
    const size = definition.size;
    const stride = reducedMotion ? 0 : Math.sin(game.elapsed * 11 + enemy.id * 1.7);
    const bob = Math.abs(stride) * -0.8;
    const facing = Math.cos(enemy.angle) >= 0 ? 1 : -1;
    const flash = (ui.hitFlashes.get(enemy.id) || 0) > 0;
    const colors = { basic: "#d94f51", runner: "#ef735c", tank: "#a93746", boss: "#7e2639" };
    context.save();
    context.translate(point.x, point.y + bob);
    context.fillStyle = "rgba(0,0,0,.28)";
    context.beginPath();
    context.ellipse(1, size + 4, size * 0.9, size * 0.35, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#632f35";
    context.lineWidth = Math.max(1.5, size * 0.18);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-size * 0.35, size * 0.55);
    context.lineTo(-size * 0.35 + stride * 3, size + 4);
    context.moveTo(size * 0.35, size * 0.55);
    context.lineTo(size * 0.35 - stride * 3, size + 4);
    context.moveTo(-size * 0.7, -size * 0.15);
    context.lineTo(-size - 2, stride * 3);
    context.moveTo(size * 0.7, -size * 0.15);
    context.lineTo(size + 2, -stride * 3);
    context.stroke();

    if (enemy.slowTimer > 0 || game.fikaRemaining > 0) {
      context.strokeStyle = "rgba(151, 225, 255, .9)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, size + 3, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = flash ? "#fff5dc" : colors[enemy.type];
    context.strokeStyle = enemy.type === "boss" ? "#ffd166" : "rgba(255,255,255,.8)";
    context.lineWidth = enemy.type === "boss" ? 2.5 : 1;
    context.beginPath();
    context.arc(0, 0, size, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.strokeStyle = "#fff7ed";
    context.lineWidth = Math.max(1.5, size * 0.17);
    context.beginPath();
    context.moveTo(-size * 0.7, 0);
    context.lineTo(size * 0.7, 0);
    context.moveTo(-size * 0.18, -size * 0.72);
    context.lineTo(-size * 0.18, size * 0.72);
    context.stroke();

    const headX = facing * size * 0.18;
    const headY = -size * 0.58;
    context.fillStyle = flash ? "#ffffff" : "#f0c5a0";
    context.beginPath();
    context.arc(headX, headY, size * 0.46, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#3d3230";
    const eyeY = headY - size * 0.06;
    context.beginPath();
    context.arc(headX - 1.5, eyeY, 0.75, 0, Math.PI * 2);
    context.arc(headX + 1.5, eyeY, 0.75, 0, Math.PI * 2);
    context.fill();
    if (enemy.type === "tank" || enemy.type === "boss") {
      context.strokeStyle = "#59362d";
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(headX - 2.5, headY + size * 0.2);
      context.lineTo(headX + 2.5, headY + size * 0.2);
      context.stroke();
    }
    if (enemy.type === "runner") {
      context.strokeStyle = "#ffe0ad";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(headX - size * 0.45, headY - 1);
      context.lineTo(headX + size * 0.45, headY - 2);
      context.stroke();
    }
    if (enemy.type === "tank") {
      context.fillStyle = "#738078";
      context.beginPath();
      context.arc(headX, headY - 1, size * 0.48, Math.PI, 0);
      context.fill();
    }
    if (enemy.type === "boss") {
      context.fillStyle = "#ffd166";
      context.beginPath();
      context.moveTo(headX - 9, headY - 3);
      context.lineTo(headX - 8, headY - 12);
      context.lineTo(headX - 3, headY - 7);
      context.lineTo(headX, headY - 14);
      context.lineTo(headX + 4, headY - 7);
      context.lineTo(headX + 9, headY - 12);
      context.lineTo(headX + 9, headY - 3);
      context.closePath();
      context.fill();
    }

    if (enemy.hp < enemy.maxHp || enemy.type === "tank" || enemy.type === "boss") {
      const width = size * 2.2;
      const y = -size - (enemy.type === "boss" ? 20 : 10);
      context.fillStyle = "rgba(13, 29, 26, .8)";
      context.fillRect(-width / 2, y, width, 3.5);
      context.fillStyle = enemy.hp / enemy.maxHp > 0.4 ? "#8de0ac" : "#ff8a76";
      context.fillRect(-width / 2, y, width * clamp(enemy.hp / enemy.maxHp, 0, 1), 3.5);
    }
    context.restore();
  }

  function drawProjectiles() {
    for (const projectile of game.projectiles) {
      if (projectile.dead) continue;
      const point = worldToScreen(projectile);
      const previous = worldToScreen({ x: projectile.lastX, y: projectile.lastY });
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const distance = Math.hypot(dx, dy) || 1;
      const color = levels.TOWER_TYPES[projectile.type].color;
      context.save();
      context.strokeStyle = color;
      context.globalAlpha = 0.48;
      context.lineWidth = projectile.type === "bulle" ? 3 : 1.8;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(point.x - dx / distance * 12, point.y - dy / distance * 12);
      context.lineTo(point.x, point.y);
      context.stroke();
      context.globalAlpha = 1;
      context.translate(point.x, point.y);
      context.rotate(projectile.age * (projectile.type === "vind" ? 14 : 8));
      context.shadowColor = projectile.type === "glass" || projectile.type === "vind" ? "#9de5ff" : "#ffe2a6";
      context.shadowBlur = 8;
      context.fillStyle = color;
      if (projectile.type === "vind") {
        context.strokeStyle = "#e8ffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(0, 0, 4.5, -1.1, 1.1);
        context.stroke();
      } else {
        context.beginPath();
        context.arc(0, 0, projectile.type === "bulle" ? 4.4 : 2.8, 0, Math.PI * 2);
        context.fill();
        if (projectile.type === "bulle") {
          context.fillStyle = "#8a4e2e";
          context.font = "8px Georgia, serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText("◎", 0, 0);
        }
      }
      context.restore();
    }
  }

  function drawStatue() {
    const point = worldToScreen(levels.STATUE);
    const healthRatio = game.health / game.config.maxHealth;
    const pulse = !reducedMotion && game.health <= 5 ? Math.sin(game.elapsed * 5) * 2 : 0;
    context.save();
    context.translate(point.x, point.y);
    context.scale(clamp(camera.scale, 0.62, 1), clamp(camera.scale, 0.62, 1));
    if (ui.statueHit > 0 && !reducedMotion) context.rotate(Math.sin(game.elapsed * 45) * ui.statueHit * 0.12);
    context.shadowColor = "rgba(0,0,0,.5)";
    context.shadowBlur = 12;
    context.fillStyle = "#153d34";
    context.beginPath();
    context.arc(0, 0, 20 + pulse, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(235, 251, 241, .55)";
    context.lineWidth = 3;
    context.stroke();
    context.strokeStyle = healthRatio > 0.3 ? "#ffd166" : "#ff7a72";
    context.lineCap = "round";
    context.beginPath();
    context.arc(0, 0, 23 + pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * healthRatio);
    context.stroke();
    context.fillStyle = "#b7ead5";
    context.font = "32px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("♞", 0, 1);
    context.font = "800 8px -apple-system, sans-serif";
    const label = text.statueLabel;
    const width = context.measureText(label).width + 12;
    context.fillStyle = "rgba(10, 32, 27, .9)";
    context.beginPath();
    context.roundRect(-width / 2, 28, width, 17, 5);
    context.fill();
    context.fillStyle = "#f1f7ed";
    context.fillText(label, 0, 37);
    context.restore();
  }

  function drawPickups(time) {
    for (const pickup of game.pickups) {
      const point = worldToScreen(pickup);
      const bob = reducedMotion ? 0 : Math.sin(time * 6 + pickup.id) * 2.5;
      const fading = pickup.life < 2 && !reducedMotion ? 0.55 + 0.45 * Math.abs(Math.sin(time * 12)) : 1;
      context.save();
      context.globalAlpha = fading;
      context.translate(point.x, point.y - 14 + bob);
      context.shadowColor = "rgba(255, 209, 102, .95)";
      context.shadowBlur = 16;
      context.fillStyle = "rgba(255, 220, 120, .35)";
      context.beginPath();
      context.arc(0, 0, 14, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = "#ffd166";
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (pickup.life / pickup.maxLife));
      context.stroke();
      context.font = "19px -apple-system, 'Apple Color Emoji', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text.pickupIcon, 0, 1);
      context.restore();
    }
  }

  function drawEffects(dt) {
    for (const ring of ui.rings) {
      const point = worldToScreen(ring);
      const progress = 1 - ring.life / ring.maxLife;
      const alpha = clamp(ring.life / ring.maxLife, 0, 1);
      const radius = (ring.startRadius || 1) + ring.radius * camera.scale * progress;
      context.globalAlpha = alpha;
      context.strokeStyle = ring.color;
      context.fillStyle = ring.color;
      context.lineWidth = ring.width || 2.5;
      context.beginPath();
      context.arc(point.x, point.y, Math.max(1, radius), 0, Math.PI * 2);
      if (ring.fill) {
        context.globalAlpha = alpha * 0.22;
        context.fill();
      } else {
        context.stroke();
      }
    }
    context.globalAlpha = 1;

    for (const particle of ui.particles) {
      const origin = worldToScreen(particle);
      const age = particle.maxLife - particle.life;
      context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(
        origin.x + particle.vx * age,
        origin.y + particle.vy * age + (particle.gravity || 0) * age * age / 2,
        Math.max(0.2, particle.size + (particle.grow || 0) * age),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.globalAlpha = 1;

    for (const floater of ui.floaters) {
      const origin = worldToScreen(floater);
      const age = floater.maxLife - floater.life;
      context.globalAlpha = clamp(floater.life / floater.maxLife, 0, 1);
      context.fillStyle = floater.color;
      context.font = `900 ${floater.size || 11}px -apple-system, sans-serif`;
      context.textAlign = "center";
      context.shadowColor = "rgba(0,0,0,.8)";
      context.shadowBlur = 4;
      context.fillText(floater.text, origin.x + (floater.xOffset || 0), origin.y - 8 - age * 28);
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;

    if (game.fikaRemaining > 0) {
      context.fillStyle = `rgba(255, 221, 150, ${0.025 + Math.sin(game.elapsed * 3) * 0.01})`;
      context.fillRect(0, 0, view.width, view.height);
    }

    const effectDt = reducedMotion ? dt * 3 : dt;
    ui.rings.forEach((ring) => { ring.life -= effectDt; });
    ui.particles.forEach((particle) => { particle.life -= effectDt; });
    ui.floaters.forEach((floater) => { floater.life -= effectDt; });
    ui.quips.forEach((quip) => { quip.life -= dt; });
    for (const [id, life] of ui.hitFlashes) {
      if (life <= effectDt) ui.hitFlashes.delete(id);
      else ui.hitFlashes.set(id, life - effectDt);
    }
    for (const [id, life] of ui.recoil) {
      if (life <= effectDt) ui.recoil.delete(id);
      else ui.recoil.set(id, life - effectDt);
    }
    ui.shake = Math.max(0, ui.shake - dt * 18);
    ui.statueHit = Math.max(0, ui.statueHit - dt * 2.5);
    ui.rings = ui.rings.filter((ring) => ring.life > 0);
    ui.particles = ui.particles.filter((particle) => particle.life > 0);
    ui.floaters = ui.floaters.filter((floater) => floater.life > 0);
    ui.quips = ui.quips.filter((quip) => quip.life > 0);
  }

  function drawQuips() {
    for (const quip of ui.quips) {
      const enemy = quip.local ? null : game.enemies.find((item) => item.id === quip.enemyId);
      const origin = worldToScreen(enemy || quip);
      const boss = enemy?.type === "boss" || quip.boss;
      const fontSize = boss ? 12 : 10;
      context.save();
      context.font = `800 ${fontSize}px -apple-system, sans-serif`;
      const width = Math.ceil(context.measureText(quip.text).width) + 16;
      const height = boss ? 25 : 22;
      const x = clamp(origin.x - width / 2, 7, Math.max(7, view.width - width - 7));
      const y = clamp(origin.y - (boss ? 48 : 38), 7, Math.max(7, view.height - height - 7));
      context.globalAlpha = clamp(quip.life / 0.25, 0, 1);
      context.shadowColor = "rgba(0,0,0,.35)";
      context.shadowBlur = 8;
      context.fillStyle = quip.local ? "#71e2bd" : boss ? "#fff0bd" : "#fffdf4";
      context.beginPath();
      context.roundRect(x, y, width, height, 7);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = quip.local ? "#0b2d24" : "#3e3030";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(quip.text, x + width / 2, y + height / 2 + 0.5);
      context.restore();
    }
  }

  function render(time, dt) {
    drawMap(time);
    drawSpawnMarkers();
    drawBuildPads(time);
    game.towers.forEach(drawTower);
    game.enemies.slice().sort((a, b) => a.y - b.y).forEach(drawEnemy);
    drawProjectiles();
    drawStatue();
    drawPickups(time);
    drawEffects(dt);
    drawQuips();
  }

  function addShake(amount) {
    const scale = mode === "american" ? 1.4 : 1;
    if (!reducedMotion) ui.shake = Math.min(14, Math.max(ui.shake, amount * scale));
  }

  // Locals shout back from the nearest defence. Mint bubbles, never more than one at a time.
  function addLocalQuip(point, phrases, options = {}) {
    if (!phrases.length || (!options.force && game.elapsed - ui.lastRetortAt < 3.5)) return;
    let origin = point;
    if (options.fromTower) {
      let nearest = Infinity;
      for (const tower of game.towers) {
        const distance = Math.hypot(tower.x - point.x, tower.y - point.y);
        if (distance < nearest) {
          nearest = distance;
          origin = tower;
        }
      }
    }
    ui.lastRetortAt = game.elapsed;
    ui.quips = ui.quips.filter((quip) => !quip.local);
    if (ui.quips.length >= 3) ui.quips.shift();
    const phrase = phrases[(Math.floor(game.elapsed * 7) + game.stats.kills) % phrases.length];
    ui.quips.push({ local: true, text: phrase, x: origin.x, y: origin.y, life: 1.8, maxLife: 1.8 });
  }

  function addQuip(enemy, text, options = {}) {
    if (!enemy) return;
    const activeTexts = new Set(ui.quips.map((quip) => quip.text));
    const previous = ui.quipHistory.get(enemy.id);
    if (activeTexts.has(text) || text === previous) {
      const alternatives = chatterPool(enemy.type).filter((phrase) => !activeTexts.has(phrase) && phrase !== previous);
      if (!alternatives.length) {
        if (activeTexts.has(text)) return;
      } else {
        text = alternatives[(enemy.id + game.currentWave) % alternatives.length];
      }
    }
    const boss = enemy.type === "boss";
    if (ui.quips.length >= 3) {
      if (!boss) return;
      ui.quips.shift();
    }
    ui.quips = ui.quips.filter((quip) => quip.enemyId !== enemy.id);
    ui.quips.push({
      enemyId: enemy.id,
      text,
      x: enemy.x,
      y: enemy.y,
      boss,
      life: options.duration || (boss ? 2.8 : 2.1),
      maxLife: options.duration || (boss ? 2.8 : 2.1),
    });
    ui.quipHistory.set(enemy.id, text);
    if (!options.silent) playSound("quip", { boss });
  }

  // Danish lines come out of shuffled bags, so a pool plays through before it repeats.
  const lineBags = new Map();

  function danishLine(key, pool) {
    if (!pool || !pool.length) return null;
    let bag = lineBags.get(key);
    if (!bag || !bag.length) {
      bag = pool.slice();
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [bag[index], bag[swap]] = [bag[swap], bag[index]];
      }
      lineBags.set(key, bag);
    }
    return bag.pop();
  }

  function chatterPool(type) {
    return [...levels.ENEMY_TYPES[type].quips, ...(DANISH.CHATTER[type] || []), ...(DANISH.MODE[mode] || [])];
  }

  function eventPool(name) {
    return [...(levels.QUIPS[name] || []), ...(DANISH.EVENTS[name] || [])];
  }

  function danishSay(enemy, name, options = {}) {
    const line = danishLine(`event:${name}`, eventPool(name));
    if (line) addQuip(enemy, line, { silent: true, duration: 1.5, ...options });
  }

  function updateQuipSchedule() {
    if (game.phase !== "wave") return;
    for (const enemy of game.enemies) {
      const next = ui.quipSchedule.get(enemy.id);
      if (!next || game.elapsed < next) continue;
      addQuip(enemy, danishLine(`chatter:${mode}:${enemy.type}`, chatterPool(enemy.type)));
      ui.quipSchedule.set(enemy.id, game.elapsed + 8 + enemy.id % 6);
    }
  }

  function burst(x, y, color, count = 8, options = {}) {
    if (reducedMotion) count = Math.min(2, count);
    const speed = options.speed || 30;
    const life = options.life || 0.7;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
      const velocity = speed * (0.45 + Math.random() * 0.8);
      ui.particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - (options.lift ?? 8),
        color,
        size: (options.size || 1.8) * (0.7 + Math.random() * 0.6),
        gravity: options.gravity || 0,
        grow: options.grow || 0,
        life,
        maxLife: life,
      });
    }
    if (ui.particles.length > 220) ui.particles.splice(0, ui.particles.length - 220);
  }

  function toast(message, warning = false) {
    const box = element("toast");
    clearTimeout(toastTimer);
    box.textContent = message;
    box.classList.toggle("warning", warning);
    box.classList.add("visible");
    toastTimer = setTimeout(() => box.classList.remove("visible"), 2400);
  }

  function initAudio() {
    if (!soundEnabled) return;
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext = new AudioContext();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.78;
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 12;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      masterGain.connect(compressor);
      compressor.connect(audioContext.destination);
      noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  }

  function tone(frequency, duration, delay = 0, volume = 0.035, type = "sine", endFrequency = frequency) {
    if (!soundEnabled || !audioContext || !masterGain) return;
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.012, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function noise(duration, delay = 0, volume = 0.025, cutoff = 900, filterType = "lowpass") {
    if (!soundEnabled || !audioContext || !noiseBuffer || !masterGain) return;
    const start = audioContext.currentTime + delay;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = noiseBuffer;
    source.playbackRate.value = 0.75 + Math.random() * 0.5;
    filter.type = filterType;
    filter.frequency.value = cutoff;
    filter.Q.value = filterType === "bandpass" ? 1.2 : 0.7;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.02);
  }

  function allowSound(key, interval) {
    if (!audioContext) return false;
    const now = audioContext.currentTime;
    if (now - (lastSoundTimes.get(key) ?? -100) < interval) return false;
    lastSoundTimes.set(key, now);
    return true;
  }

  function playSound(name, detail = {}) {
    if (!soundEnabled || !audioContext) return;
    if (name === "shot") {
      const type = detail.projectileType;
      if (!allowSound(`shot-${type}`, type === "falafel" ? 0.055 : 0.09)) return;
      if (type === "bulle") {
        tone(115, 0.18, 0, 0.055, "sine", 48);
        noise(0.09, 0, 0.025, 420);
      } else if (type === "glass") {
        tone(880, 0.09, 0, 0.012, "sine", 390);
      } else if (type === "vind") {
        noise(0.16, 0, 0.022, 1300, "bandpass");
      } else {
        tone(470 + Math.random() * 90, 0.055, 0, 0.013, "triangle", 230);
      }
    } else if (name === "explosion") {
      if (!allowSound("explosion", 0.08)) return;
      tone(92, 0.34, 0, 0.085, "sine", 34);
      noise(0.3, 0, 0.065, 760);
    } else if (name === "kill") {
      if (!allowSound("kill", 0.055)) return;
      const pitch = 610 + Math.min(10, detail.combo || 1) * 32;
      tone(pitch, 0.09, 0, 0.015, "triangle", pitch * 1.35);
    } else if (name === "knockback") {
      if (allowSound("knockback", 0.12)) noise(0.18, 0, 0.026, 1500, "bandpass");
    } else if (name === "quip") {
      if (!allowSound("quip", 0.24)) return;
      const base = detail.boss ? 105 : 175 + Math.random() * 55;
      tone(base, 0.1, 0, 0.014, "sawtooth", base * 0.82);
      tone(base * 1.25, 0.12, 0.1, 0.011, "sawtooth", base * 0.95);
    } else if (name === "build") {
      tone(330, 0.12, 0, 0.04, "triangle", 390);
      tone(495, 0.16, 0.08, 0.03, "triangle", 620);
      noise(0.08, 0, 0.015, 1400, "bandpass");
    } else if (name === "upgrade") {
      tone(440, 0.12, 0, 0.035, "triangle");
      tone(660, 0.16, 0.08, 0.035, "triangle");
      tone(880, 0.2, 0.16, 0.025, "triangle");
    } else if (name === "sell") {
      tone(500, 0.12, 0, 0.025, "triangle", 320);
    } else if (name === "wave" || name === "boss") {
      const root = name === "boss" ? 82 : 196;
      tone(root, 0.28, 0, name === "boss" ? 0.075 : 0.05, "square", root * 0.85);
      tone(root * 1.5, 0.28, 0.17, 0.04, "square");
      if (name === "boss") noise(0.5, 0, 0.035, 320);
    } else if (name === "leak") {
      tone(145, 0.36, 0, 0.07, "sawtooth", 65);
      noise(0.18, 0, 0.03, 400);
    } else if (name === "clear") {
      tone(392, 0.15, 0, 0.035, "triangle");
      tone(523, 0.2, 0.12, 0.035, "triangle");
    } else if (name === "fika") {
      tone(523, 0.2, 0, 0.03, "sine");
      tone(659, 0.3, 0.13, 0.03, "sine");
    } else if (name === "fireworks") {
      if (!allowSound("fireworks", 0.1)) return;
      for (let index = 0; index < 4; index += 1) {
        noise(0.07, index * 0.045, 0.03, 2600 + Math.random() * 2000, "highpass");
      }
      tone(780 + Math.random() * 400, 0.25, 0, 0.012, "sine", 1900);
      tone(70, 0.25, 0.05, 0.05, "sine", 40);
    } else if (name === "gust") {
      noise(0.9, 0, 0.05, 520, "bandpass");
      noise(0.6, 0.2, 0.03, 900, "bandpass");
    } else if (name === "home") {
      if (!allowSound("home", 0.12)) return;
      tone(392, 0.09, 0, 0.022, "triangle");
      tone(523, 0.09, 0.07, 0.022, "triangle");
      tone(1046, 0.12, 0.14, 0.014, "sine");
    } else if (name === "splash") {
      if (!allowSound("splash", 0.1)) return;
      tone(900, 0.12, 0, 0.03, "sine", 180);
      noise(0.25, 0.03, 0.03, 1800, "lowpass");
    } else if (name === "pickupDrop") {
      tone(1320, 0.08, 0, 0.018, "sine");
      tone(1760, 0.12, 0.06, 0.014, "sine");
    } else if (name === "pickup") {
      [784, 988, 1175, 1568].forEach((note, index) => tone(note, 0.1, index * 0.045, 0.026, "triangle"));
    } else if (name === "streak") {
      const root = 523 * 2 ** (Math.min(4, detail.count / 5 - 1) / 12 * 2);
      tone(root, 0.12, 0, 0.03, "square", root * 1.5);
      tone(root * 1.5, 0.18, 0.08, 0.022, "square");
    } else if (name === "win") {
      [392, 494, 587, 784].forEach((note, index) => tone(note, 0.4, index * 0.15, 0.04, "triangle"));
    } else if (name === "lose") {
      [294, 247, 196].forEach((note, index) => tone(note, 0.35, index * 0.18, 0.04, "triangle"));
    }
  }

  function showEnd(won) {
    if (ui.endShown) return;
    ui.endShown = true;
    const cleared = won ? game.currentWave : game.currentWave - 1;
    const record = recordBest(cleared);
    element("end-eyebrow").textContent = won ? t("winEyebrow") : t("loseEyebrow");
    element("end-title").textContent = won ? t("winTitle") : t("loseTitle");
    element("end-message").textContent = won
      ? t("winMessage")
      : t(game.endless ? "endlessLoseMessage" : "loseMessage", { n: game.currentWave, cleared });
    element("end-icon").textContent = won ? "♞" : "☕";
    element("end-best").textContent = record ? `${t("newBest")} ${t("best", { n: cleared })}` : bestLine();
    element("end-best").classList.toggle("record", record);
    element("endless-game").hidden = !won;
    element("end-kills").textContent = game.stats.kills;
    element("end-health").textContent = game.health;
    element("end-towers").textContent = game.stats.towersBuilt;
    element("end-modal").hidden = false;
    playSound(won ? "win" : "lose");
    element(won ? "endless-game" : "restart-game").focus();
  }

  function showWaveBanner(kicker, title, duration = 2200) {
    clearTimeout(waveBannerTimer);
    setText("wave-banner-kicker", kicker);
    setText("wave-banner-title", title);
    element("wave-banner").classList.add("visible");
    waveBannerTimer = setTimeout(() => element("wave-banner").classList.remove("visible"), duration);
  }

  function addFloater(floater) {
    ui.floaters.push({ life: 0.8, maxLife: 0.8, ...floater });
    if (ui.floaters.length > 60) ui.floaters.shift();
  }

  function bestLine() {
    const best = readBest(mode);
    return best ? t("best", { n: best }) : t("noBest");
  }

  function splashIfCanal(event) {
    if (distanceToCanal(event) > CANAL_WIDTH) return false;
    ui.rings.push(
      { x: event.x, y: event.y, radius: 22, color: "#bfe9ff", life: 0.5, maxLife: 0.5, width: 2 },
      { x: event.x, y: event.y, radius: 36, color: "#7cc8f0", life: 0.75, maxLife: 0.75, width: 1.5 },
    );
    burst(event.x, event.y, "#c9efff", 14, { speed: 46, gravity: 120, lift: 50, size: 2 });
    addFloater({ x: event.x, y: event.y, text: t("splash"), color: "#bfe9ff", size: 14, life: 1, maxLife: 1 });
    playSound("splash");
    return true;
  }

  function processEvents() {
    for (const event of game.drainEvents()) {
      if (event.type === "build") {
        burst(event.x, event.y, levels.TOWER_TYPES[event.tower.type].color, 12, { speed: 42, gravity: 45 });
        ui.rings.push({ x: event.x, y: event.y, radius: 24, color: levels.TOWER_TYPES[event.tower.type].color, life: 0.4, maxLife: 0.4 });
        playSound("build");
      } else if (event.type === "upgrade") {
        burst(event.x, event.y, "#ffd166", 18, { speed: 55, gravity: 55 });
        ui.rings.push({ x: event.x, y: event.y, radius: 30, color: "#ffd166", life: 0.45, maxLife: 0.45 });
        addShake(1.2);
        playSound("upgrade");
      } else if (event.type === "sell") {
        addFloater({ x: event.x, y: event.y, text: `+${event.refund} kr`, color: "#ffd166", life: 1, maxLife: 1 });
        playSound("sell");
      } else if (event.type === "wave") {
        ui.routePreview = 6;
        showWaveBanner(t("bannerWave", {
          n: event.wave,
          k: event.routes.length,
          approaches: event.routes.length === 1 ? text.approach : text.approaches,
        }), event.name);
        if (event.earlyBonus) toast(t("toastEarly", { bonus: formatMoney(event.earlyBonus) }));
        playSound("wave");
      } else if (event.type === "spawn") {
        const enemy = event.enemy;
        ui.quipSchedule.set(enemy.id, game.elapsed + 4 + enemy.id % 5);
        const routeKey = `${game.currentWave}:${enemy.routeId}`;
        if (enemy.type === "boss") {
          ui.routePreview = 3;
          const route = game.getRoute(enemy.routeId).name.toUpperCase();
          const intro = danishLine("bossIntro", DANISH.EVENTS.bossIntro);
          showWaveBanner(t(game.endless ? "bannerEndlessBoss" : "bannerBoss", { route }), intro, 2400);
          addQuip(enemy, intro, { silent: true });
          addShake(5);
          playSound("boss");
        } else if (!ui.routesGreeted.has(routeKey) && DANISH.ROUTES[enemy.routeId]) {
          // The first Dane on each street this wave comments on where they are.
          ui.routesGreeted.add(routeKey);
          addQuip(enemy, danishLine(`route:${enemy.routeId}`, DANISH.ROUTES[enemy.routeId]));
        } else if (enemy.id % 4 === 0) {
          addQuip(enemy, danishLine(`chatter:${mode}:${enemy.type}`, chatterPool(enemy.type)));
        }
      } else if (event.type === "shot") {
        const duration = event.projectileType === "bulle" ? 0.22 : 0.13;
        ui.recoil.set(event.tower.id, duration);
        burst(
          event.tower.x + Math.cos(event.tower.angle) * 8,
          event.tower.y + Math.sin(event.tower.angle) * 8,
          "#fff0b0",
          event.projectileType === "bulle" ? 4 : 2,
          { speed: 18, life: 0.22, lift: 0, size: 1.4 },
        );
        if (event.projectileType === "bulle") addShake(0.8);
        playSound("shot", { projectileType: event.projectileType });
      } else if (event.type === "hit") {
        ui.hitFlashes.set(event.enemy.id, 0.11);
        const lastNumber = ui.lastDamageNumbers.get(event.enemy.id) ?? -100;
        if (event.killed || game.elapsed - lastNumber > 0.22) {
          const color = event.sourceType === "bulle" ? "#ffd09a" : event.sourceType === "glass" || event.sourceType === "vind" ? "#c5f4ff" : event.sourceType === "fika" ? "#ffb3c7" : "#fff5df";
          addFloater({
            x: event.x,
            y: event.y,
            text: `${Math.round(event.amount)}`,
            color,
            size: event.sourceType === "bulle" ? 13 : 10,
            xOffset: (event.enemy.id % 3 - 1) * 5,
          });
          ui.lastDamageNumbers.set(event.enemy.id, game.elapsed);
        }
        if (event.sourceType !== "bulle") burst(event.x, event.y, "#fff1cf", 2, { speed: 22, life: 0.25, lift: 0 });
      } else if (event.type === "kill") {
        const splashed = splashIfCanal(event);
        if (!splashed) burst(event.x, event.y, "#e66b62", 7, { speed: 48, gravity: 65 });
        addFloater({ x: event.x, y: event.y, text: `+${event.bounty}`, color: "#ffe092", xOffset: 8 });
        if (event.tip) {
          addFloater({ x: event.x, y: event.y + 12, text: t("tip", { tip: event.tip }), color: "#ffb3c7", size: 9, xOffset: 14, life: 1, maxLife: 1 });
        }
        if (splashed) {
          danishSay(event.enemy, "splash", { duration: 1.4 });
        } else if (event.enemy.id % 5 === 0) {
          danishSay(event.enemy, "defeat", { duration: 1.4 });
        } else if (event.enemy.id % 3 === 0) {
          addLocalQuip(event, text.retorts, { fromTower: true });
        }
        playSound("kill", { combo: game.streak.count });
      } else if (event.type === "streak") {
        addFloater({ x: event.x, y: event.y - 10, text: `${t("streak", { n: event.count })} +${event.reward}`, color: "#ffd166", size: 15, life: 1.3, maxLife: 1.3 });
        ui.rings.push({ x: event.x, y: event.y, radius: 40, color: "#ffd166", life: 0.5, maxLife: 0.5, width: 3 });
        addShake(1.5);
        playSound("streak", { count: event.count });
      } else if (event.type === "home") {
        burst(event.x, event.y, "#c5f4ff", 10, { speed: 55, life: 0.6, lift: 25 });
        burst(event.x, event.y, "#ffd166", 6, { speed: 30, gravity: 60 });
        addFloater({ x: event.x, y: event.y, text: `+${event.payout}`, color: "#ffe092", size: 13, xOffset: 8 });
        if (event.enemy.id % 2 === 0) danishSay(event.enemy, "home", { duration: 1.6 });
        else addLocalQuip(event, text.homeQuips, { force: true });
        playSound("home");
      } else if (event.type === "gust") {
        for (let index = 0; index < (reducedMotion ? 4 : 26); index += 1) {
          const y = Math.random() * levels.MAP.height;
          const x = Math.random() * levels.MAP.width;
          ui.particles.push({ x, y, vx: -140 - Math.random() * 90, vy: (Math.random() - 0.5) * 12, color: "rgba(230, 255, 252, .7)", size: 1.3, life: 0.9, maxLife: 0.9, lift: 0 });
        }
        addLocalQuip(levels.STATUE, text.gustQuips, { force: true });
        const windswept = game.enemies.find((enemy) => !enemy.dead);
        if (windswept) danishSay(windswept, "gust");
        addShake(2);
        playSound("gust");
      } else if (event.type === "fireworks") {
        const palette = ["#ff4d5e", "#ffffff", "#5b8cff", "#ffd166"];
        event.targets.slice(0, 18).forEach((target, index) => {
          const color = palette[index % palette.length];
          ui.rings.push({ x: target.x, y: target.y - 6, radius: 18, color, life: 0.45, maxLife: 0.45, width: 2 });
          burst(target.x, target.y - 8, color, 9, { speed: 70, gravity: 70, life: 0.65, size: 1.7 });
        });
        if (event.targets.length) addLocalQuip(levels.STATUE, text.fireworksQuips);
        const dazzled = game.enemies.filter((enemy) => !enemy.dead)[ui.fireworksSpoken++ % 3];
        if (dazzled) danishSay(dazzled, "fireworks");
        addShake(2.2);
        playSound("fireworks");
      } else if (event.type === "pickupDrop") {
        ui.rings.push({ x: event.pickup.x, y: event.pickup.y - 14, radius: 24, color: "#ffd166", life: 0.5, maxLife: 0.5 });
        playSound("pickupDrop");
      } else if (event.type === "pickup") {
        burst(event.x, event.y - 14, "#ffd166", 16, { speed: 60, gravity: 50, size: 2.2 });
        addFloater({ x: event.x, y: event.y - 14, text: `+${event.value}`, color: "#ffd166", size: 16, life: 1.1, maxLife: 1.1 });
        toast(t("toastPickup", { value: formatMoney(event.value) }));
        playSound("pickup");
      } else if (event.type === "endless") {
        ui.routePreview = Infinity;
        toast(t("toastEndless"));
      } else if (event.type === "explosion") {
        ui.rings.push(
          { x: event.x, y: event.y, radius: event.radius * 0.65, color: "#fff1b0", life: 0.16, maxLife: 0.16, fill: true, startRadius: 5 },
          { x: event.x, y: event.y, radius: event.radius * 1.3, color: "#ffc17c", life: 0.42, maxLife: 0.42, width: 3.5 },
          { x: event.x, y: event.y, radius: event.radius * 1.8, color: "#e87950", life: 0.58, maxLife: 0.58, width: 1.5 },
        );
        burst(event.x, event.y, "#ffb36b", 18, { speed: 78, gravity: 80, size: 2.3 });
        burst(event.x, event.y, "#5c615b", 7, { speed: 22, life: 1.1, grow: 5, size: 3, lift: 14 });
        addShake(3.4);
        playSound("explosion");
      } else if (event.type === "slow") {
        if (event.enemy.id % 4 === 0 && game.elapsed - ui.lastSlowQuipAt > 4) {
          ui.lastSlowQuipAt = game.elapsed;
          danishSay(event.enemy, "slow", { duration: 1.4 });
        }
      } else if (event.type === "knockback") {
        burst(event.x, event.y, "#c5f4ff", 5, { speed: 35, life: 0.4, lift: 0 });
        if (event.enemy.id % 3 === 0) danishSay(event.enemy, "knockback");
        playSound("knockback");
      } else if (event.type === "leak") {
        addShake(9);
        ui.statueHit = 1;
        addFloater({ x: event.x, y: event.y, text: `−${event.damage}`, color: "#ff8a7e", size: 20, life: 1.1, maxLife: 1.1 });
        danishSay(event.enemy, "leak");
        const vignette = element("damage-vignette");
        vignette.classList.remove("flash");
        void vignette.offsetWidth;
        vignette.classList.add("flash");
        toast(t("toastLeak", { n: event.damage }), true);
        playSound("leak");
      } else if (event.type === "waveComplete") {
        ui.routePreview = Infinity;
        toast(t("toastCleared", { reward: formatMoney(event.reward), healed: event.healed ? text.toastHealed : "" }));
        playSound("clear");
      } else if (event.type === "fika") {
        toast(t("toastFika"));
        ui.rings.push(
          { x: levels.STATUE.x, y: levels.STATUE.y, radius: 160, color: "#ffe09a", life: 0.8, maxLife: 0.8 },
          { x: levels.STATUE.x, y: levels.STATUE.y, radius: 105, color: "#fff2c7", life: 0.55, maxLife: 0.55 },
        );
        if (event.kind !== "fireworks") {
          game.enemies.slice(0, 2).forEach((enemy, index) => danishSay(enemy, "fika", { silent: index > 0, duration: 2 }));
        }
        addShake(1);
        playSound("fika");
      } else if (event.type === "win") {
        setTimeout(() => showEnd(true), 500);
      } else if (event.type === "lose") {
        setTimeout(() => showEnd(false), 500);
      }
    }
  }

  function setText(id, text) {
    const node = element(id);
    const value = String(text);
    if (node.textContent !== value) node.textContent = value;
  }

  function updateSelection() {
    const tower = game.towers.find((item) => item.id === ui.selectedTowerId);
    const panel = element("selection-panel");
    if (!tower) {
      ui.selectedTowerId = null;
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const definition = levels.TOWER_TYPES[tower.type];
    const stats = game.getTowerStats(tower);
    const multiplier = game.getFireRateMultiplier(tower);
    const unit = text.rangeUnit;
    setText("selection-kicker", t("selectionKicker", {
      level: tower.level,
      range: Math.round(stats.range * text.rangeFactor),
      unit,
      boost: multiplier > 1 ? text.selectionBoost : "",
    }));
    setText("selection-name", definition.name);
    if (definition.support) {
      const allies = game.towers.filter((ally) => ally.id !== tower.id && !levels.TOWER_TYPES[ally.type].support && Math.hypot(ally.x - tower.x, ally.y - tower.y) <= stats.range).length;
      setText("selection-stats", t("supportStats", { pct: Math.round(stats.haste * 100), n: allies, allies: allies === 1 ? text.ally : text.allies }));
    } else {
      const extras = stats.splash ? t("statSplash", { n: Math.round(stats.splash) })
        : stats.slowDuration ? t("statSlow", { pct: Math.round((1 - stats.slowFactor) * 100) })
          : stats.knockback ? t("statPush", { n: Math.round(stats.knockback * text.rangeFactor), unit }) : "";
      const heavy = stats.heavyBonus > 1 ? t("statHeavy", { pct: Math.round((stats.heavyBonus - 1) * 100) }) : "";
      const effectiveRate = stats.rate / multiplier;
      setText("selection-stats", t("towerStats", { damage: stats.damage, rate: effectiveRate.toFixed(2), extras, heavy }));
    }
    const upgrade = element("upgrade-button");
    const cost = game.getUpgradeCost(tower);
    upgrade.disabled = cost === null;
    const upgradeHtml = cost === null ? text.maxLevel : `${text.upgrade} <span>${formatMoney(cost)}</span>`;
    if (upgrade.innerHTML !== upgradeHtml) upgrade.innerHTML = upgradeHtml;
    const sellHtml = `${text.sell} <span>${formatMoney(Math.floor(tower.invested * game.config.sellRefund))}</span>`;
    if (element("sell-button").innerHTML !== sellHtml) element("sell-button").innerHTML = sellHtml;
  }

  function updateHUD() {
    setText("health-value", game.health);
    setText("money-value", formatMoney(game.money));
    setText("wave-value", game.currentWave || "–");
    setText("wave-total", game.endless ? " / ∞" : ` / ${game.totalWaves}`);
    element("health-stat").classList.toggle("hurt", game.health <= 5);
    const comboChip = element("combo-chip");
    const streakLive = game.streak.count >= 3 && game.elapsed - game.streak.lastKillAt <= game.config.streakWindow;
    comboChip.classList.toggle("visible", streakLive);
    if (streakLive) setText("combo-chip", t("streak", { n: game.streak.count }));

    const remaining = game.enemies.length + game.spawnQueue.length;
    const chip = element("phase-chip");
    chip.classList.toggle("wave", game.phase === "wave");
    chip.classList.toggle("fika", game.fikaRemaining > 0);
    let phaseText = t("phaseBuild");
    if (ui.started && ui.paused) phaseText = t("phasePaused");
    else if (game.fikaRemaining > 0) phaseText = t("phaseFika", { s: Math.ceil(game.fikaRemaining) });
    else if (game.phase === "wave") phaseText = t("phaseWave", { n: game.currentWave, left: remaining });
    else if (game.phase === "intermission") phaseText = t("phaseNext", { s: Math.ceil(game.intermission) });
    else if (game.phase === "won") phaseText = t("phaseWon");
    else if (game.phase === "lost") phaseText = t("phaseLost");
    setText("phase-chip", phaseText);

    const showCurrent = game.phase === "wave" || game.phase === "lost" || (game.phase === "won" && !game.endless);
    const shownWave = showCurrent ? game.getWave() : game.getNextWave();
    if (shownWave) {
      const number = showCurrent ? game.currentWave : game.currentWave + 1;
      setText("wave-eyebrow", game.phase === "wave"
        ? t(game.endless ? "eyebrowEndless" : "eyebrowWave", { n: number, total: game.totalWaves, left: remaining })
        : t("eyebrowNext", { n: number }));
      setText("wave-title", shownWave.name);
      const routeNames = shownWave.routes.map((routeId) => game.getRoute(routeId).name).join(" · ");
      setText("wave-routes", routeNames);
      element("wave-routes").title = routeNames;
    }

    const nextButton = element("next-wave");
    nextButton.disabled = game.phase !== "ready" && game.phase !== "intermission";
    if (game.phase === "intermission") {
      setText("next-wave-label", t("startEarly", { n: game.currentWave + 1, bonus: formatMoney(Math.ceil(game.intermission)) }));
      setText("next-wave-detail", t("startEarlyDetail", { s: Math.ceil(game.intermission) }));
    } else if (game.phase === "ready") {
      setText("next-wave-label", t("startFirst"));
      setText("next-wave-detail", t("startFirstDetail"));
    } else if (game.phase === "wave") {
      setText("next-wave-label", t("inWave", { left: remaining }));
      setText("next-wave-detail", t("inWaveDetail"));
    } else {
      setText("next-wave-label", game.phase === "won" ? t("wonButton") : t("lostButton"));
      setText("next-wave-detail", "");
    }

    document.querySelectorAll(".tower-card").forEach((button) => {
      const type = button.dataset.tower;
      const selected = ui.selectedType === type;
      button.classList.toggle("selected", selected);
      button.classList.toggle("unaffordable", game.money < levels.TOWER_TYPES[type].cost);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !game.canBuild();
    });

    const fikaButton = element("fika-button");
    fikaButton.disabled = game.phase !== "wave" || game.fikaCooldown > 0;
    if (game.fikaRemaining > 0) setText("fika-state", t("fikaActive", { s: Math.ceil(game.fikaRemaining) }));
    else if (game.fikaCooldown > 0) setText("fika-state", `${Math.ceil(game.fikaCooldown)} S`);
    else setText("fika-state", t("fikaReady"));

    const pause = element("pause-button");
    pause.textContent = ui.paused ? "▶" : "Ⅱ";
    pause.classList.toggle("active", ui.paused);
    pause.setAttribute("aria-label", ui.paused ? "Resume game" : "Pause game");
    setText("speed-button", `${ui.speed}×`);
    setText("sound-button", soundEnabled ? "♪" : "×");
    element("sound-button").classList.toggle("active", soundEnabled);
    element("sound-button").setAttribute("aria-label", soundEnabled ? "Mute sound" : "Enable sound");

    const hint = element("game-hint");
    let hintText = "";
    if (!mapReady) hintText = t("hintLoading");
    else if (ui.started && ui.paused) hintText = t("hintPaused");
    else if (ui.selectedType) hintText = t("hintBuild", { name: levels.TOWER_TYPES[ui.selectedType].name });
    else if (!game.towers.length && game.phase === "ready") hintText = t("hintFirst");
    setText("game-hint", hintText);

    canvas.classList.toggle("building", Boolean(ui.selectedType));
    updateSelection();
  }

  function selectBuildType(type) {
    if (!game.canBuild()) return;
    ui.selectedType = ui.selectedType === type ? null : type;
    ui.selectedTowerId = null;
    ui.hoveredPadId = null;
    updateHUD();
  }

  function selectTower(towerId) {
    ui.selectedTowerId = towerId;
    ui.selectedType = null;
    ui.hoveredPadId = null;
    updateHUD();
  }

  function resultFeedback(result) {
    if (!result.ok) {
      const template = text.errors[result.code];
      toast(template ? fill(template, { ...result, amount: formatMoney(result.amount) }) : result.reason, true);
    }
    return result.ok;
  }

  function startNextWave() {
    initAudio();
    if (game.startWave()) {
      ui.selectedTowerId = null;
      accumulator = 0;
      processEvents();
    }
  }

  function togglePause() {
    if (!ui.started || game.phase === "won" || game.phase === "lost") return;
    ui.paused = !ui.paused;
    accumulator = 0;
    updateHUD();
  }

  function resetGame() {
    game.reset();
    ui.selectedType = null;
    ui.selectedTowerId = null;
    ui.hoveredPadId = null;
    ui.routePreview = Infinity;
    ui.particles.length = 0;
    ui.rings.length = 0;
    ui.floaters.length = 0;
    ui.quips.length = 0;
    ui.quipSchedule.clear();
    ui.quipHistory.clear();
    ui.hitFlashes.clear();
    ui.recoil.clear();
    ui.lastDamageNumbers.clear();
    ui.shake = 0;
    ui.shakeOffset = { x: 0, y: 0 };
    ui.statueHit = 0;
    ui.lastRetortAt = -100;
    ui.lastSlowQuipAt = -100;
    ui.routesGreeted.clear();
    lineBags.clear();
    clearTimeout(waveBannerTimer);
    element("wave-banner").classList.remove("visible");
    ui.paused = false;
    ui.started = true;
    ui.endShown = false;
    accumulator = 0;
    element("end-modal").hidden = true;
    fitCamera();
    processEvents();
    updateHUD();
  }

  function handleTap(point, pointerType = "mouse") {
    if (!ui.started || ui.helpOpen || !element("end-modal").hidden) return;
    // Pickups float above the map and win over everything else in a generous radius.
    let nearestPickup = null;
    let nearestPickupDistance = 34;
    for (const pickup of game.pickups) {
      const screen = worldToScreen({ x: pickup.x, y: pickup.y });
      const distance = Math.hypot(screen.x - point.x, screen.y - 14 - point.y);
      if (distance < nearestPickupDistance) {
        nearestPickup = pickup;
        nearestPickupDistance = distance;
      }
    }
    if (nearestPickup) {
      initAudio();
      game.collectPickup(nearestPickup.id);
      processEvents();
      updateHUD();
      return;
    }
    let nearestTower = null;
    let nearestTowerDistance = 26;
    for (const tower of game.towers) {
      const screen = worldToScreen(tower);
      const distance = Math.hypot(screen.x - point.x, screen.y - point.y);
      if (distance < nearestTowerDistance) {
        nearestTower = tower;
        nearestTowerDistance = distance;
      }
    }
    if (nearestTower) {
      selectTower(nearestTower.id);
      return;
    }

    let nearestPad = null;
    let nearestPadDistance = 28;
    for (const pad of levels.BUILD_PADS) {
      const screen = worldToScreen(pad);
      const distance = Math.hypot(screen.x - point.x, screen.y - point.y);
      if (distance < nearestPadDistance) {
        nearestPad = pad;
        nearestPadDistance = distance;
      }
    }

    if (ui.selectedType && nearestPad) {
      const result = game.buildTower(nearestPad.id, ui.selectedType);
      if (resultFeedback(result)) {
        if (pointerType !== "mouse") ui.selectedType = null;
        processEvents();
      }
    } else {
      ui.selectedTowerId = null;
      ui.selectedType = null;
      ui.hoveredPadId = null;
    }
    updateHUD();
  }

  const pointers = new Map();
  let gesture = null;

  function makePanGesture(pointer, moved = false) {
    return {
      type: "pan",
      pointerId: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      cameraX: camera.x,
      cameraY: camera.y,
      moved,
    };
  }

  function makePinchGesture() {
    const pair = Array.from(pointers.values()).slice(0, 2);
    const midpoint = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
    return {
      type: "pinch",
      distance: Math.max(1, Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)),
      scale: camera.scale,
      worldMidpoint: screenToWorld(midpoint),
      moved: true,
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!ui.started || ui.helpOpen || !element("end-modal").hidden) return;
    const point = pointFromEvent(event);
    const pointer = { id: event.pointerId, x: point.x, y: point.y, pointerType: event.pointerType };
    pointers.set(event.pointerId, pointer);
    canvas.setPointerCapture(event.pointerId);
    gesture = pointers.size === 1 ? makePanGesture(pointer) : makePinchGesture();
    canvas.classList.add("dragging");
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = pointFromEvent(event);
    if (!pointers.has(event.pointerId)) {
      if (event.pointerType === "mouse") {
        let nearest = null;
        let distance = 24;
        for (const pad of levels.BUILD_PADS) {
          const screen = worldToScreen(pad);
          const candidate = Math.hypot(screen.x - point.x, screen.y - point.y);
          if (candidate < distance) {
            nearest = pad.id;
            distance = candidate;
          }
        }
        ui.hoveredPadId = nearest;
      }
      return;
    }

    const pointer = pointers.get(event.pointerId);
    pointer.x = point.x;
    pointer.y = point.y;
    if (!gesture) return;

    if (gesture.type === "pinch" && pointers.size >= 2) {
      const pair = Array.from(pointers.values()).slice(0, 2);
      const midpoint = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
      const distance = Math.max(1, Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y));
      camera.scale = clamp(gesture.scale * distance / gesture.distance, view.fitScale * 0.85, view.fitScale * 4);
      camera.x = gesture.worldMidpoint.x - (midpoint.x - view.width / 2) / camera.scale;
      camera.y = gesture.worldMidpoint.y - (midpoint.y - view.height / 2) / camera.scale;
      clampCamera();
    } else if (gesture.type === "pan" && gesture.pointerId === event.pointerId) {
      const dx = point.x - gesture.startX;
      const dy = point.y - gesture.startY;
      if (Math.hypot(dx, dy) > 5) gesture.moved = true;
      if (gesture.moved) {
        camera.x = gesture.cameraX - dx / camera.scale;
        camera.y = gesture.cameraY - dy / camera.scale;
        clampCamera();
      }
    }
    event.preventDefault();
  });

  function finishPointer(event, cancelled) {
    if (!pointers.has(event.pointerId)) return;
    const point = pointFromEvent(event);
    const wasTap = !cancelled && gesture?.type === "pan" && !gesture.moved && pointers.size === 1;
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (pointers.size === 0) {
      gesture = null;
      canvas.classList.remove("dragging");
    } else if (pointers.size === 1) {
      gesture = makePanGesture(Array.from(pointers.values())[0], true);
    } else {
      gesture = makePinchGesture();
    }
    if (wasTap) handleTap(point, event.pointerType);
  }

  canvas.addEventListener("pointerup", (event) => finishPointer(event, false));
  canvas.addEventListener("pointercancel", (event) => finishPointer(event, true));
  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && !pointers.has(event.pointerId)) ui.hoveredPadId = null;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomAt(pointFromEvent(event), Math.exp(-event.deltaY * 0.0012));
  }, { passive: false });

  document.querySelectorAll(".tower-card").forEach((button) => {
    button.addEventListener("click", () => selectBuildType(button.dataset.tower));
  });
  element("next-wave").addEventListener("click", startNextWave);
  element("pause-button").addEventListener("click", togglePause);
  element("speed-button").addEventListener("click", () => {
    ui.speed = ui.speed === 1 ? 2 : 1;
    accumulator = 0;
    updateHUD();
  });
  element("sound-button").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem("stortorget-sound", soundEnabled ? "on" : "off"); } catch (_) {}
    if (soundEnabled) {
      initAudio();
      tone(440, 0.1, 0, 0.025, "triangle");
    } else if (audioContext) {
      audioContext.suspend().catch(() => {});
    }
    updateHUD();
  });
  element("fika-button").addEventListener("click", () => {
    initAudio();
    if (resultFeedback(game.useFika())) processEvents();
    updateHUD();
  });
  element("upgrade-button").addEventListener("click", () => {
    if (ui.selectedTowerId && resultFeedback(game.upgradeTower(ui.selectedTowerId))) processEvents();
    updateHUD();
  });
  element("sell-button").addEventListener("click", () => {
    if (ui.selectedTowerId && resultFeedback(game.sellTower(ui.selectedTowerId))) {
      ui.selectedTowerId = null;
      processEvents();
    }
    updateHUD();
  });
  element("close-selection").addEventListener("click", () => {
    ui.selectedTowerId = null;
    updateHUD();
  });
  element("zoom-in").addEventListener("click", () => zoomAt({ x: view.width / 2, y: view.height / 2 }, 1.3));
  element("zoom-out").addEventListener("click", () => zoomAt({ x: view.width / 2, y: view.height / 2 }, 1 / 1.3));
  element("zoom-fit").addEventListener("click", fitCamera);

  function runInProgress() {
    return ui.started && (game.currentWave > 0 || game.towers.length > 0) && game.phase !== "won" && game.phase !== "lost";
  }

  // Relabels the whole interface. Called on load and whenever the mode changes.
  function applyTexts(modeId = mode) {
    text = TEXT[modeId];
    document.documentElement.lang = text.lang;
    document.documentElement.dataset.gameMode = modeId;
    document.querySelectorAll("[data-t]").forEach((node) => { node.textContent = text[node.dataset.t]; });
    document.querySelectorAll("[data-t-html]").forEach((node) => { node.innerHTML = text[node.dataset.tHtml]; });
    const previewLevels = modeId === mode ? levels : window.StortorgetLevels.applyMode(window.StortorgetLevels, modeId);
    document.querySelectorAll("[data-tower-name]").forEach((node) => {
      const definition = previewLevels.TOWER_TYPES[node.dataset.towerName];
      node.textContent = definition.name;
      node.dataset.short = definition.shortName;
    });
    document.querySelectorAll("[data-tower-tag]").forEach((node) => {
      node.textContent = text.taglines[node.dataset.towerTag];
    });
    document.querySelectorAll("[data-tower-cost]").forEach((node) => {
      node.textContent = text.money(previewLevels.TOWER_TYPES[node.dataset.towerCost].cost);
    });
    const grid = element("how-to-grid");
    grid.innerHTML = "";
    text.steps.forEach(([title, body], index) => {
      const card = document.createElement("div");
      const number = document.createElement("span");
      const heading = document.createElement("strong");
      const copy = document.createElement("p");
      number.textContent = String(index + 1).padStart(2, "0");
      heading.textContent = title;
      copy.textContent = body;
      card.append(number, heading, copy);
      grid.append(card);
    });
    document.querySelectorAll(".mode-switch [data-mode]").forEach((button) => {
      button.setAttribute("aria-checked", String(button.dataset.mode === modeId));
    });
    element("intro-title").textContent = ui.helpOpen ? text.helpTitle : text.introTitle;
    const switching = modeId !== mode && runInProgress();
    const startLabel = switching ? t("newRun", { mode: text.modeName })
      : ui.helpOpen ? text.helpBack : text.introStart;
    element("start-game").innerHTML = `${startLabel} <span>→</span>`;
    element("intro-best").textContent = (() => {
      const best = readBest(modeId);
      return best ? fill(text.best, { n: best }) : text.noBest;
    })();
    setText("mode-button", text.modeShort);
    for (const [id, key] of [["pause-button", "pause"], ["speed-button", "speed"], ["sound-button", "sound"], ["help-button", "help"], ["mode-button", "modeButton"]]) {
      element(id).title = text[key];
    }
    element("mode-button").setAttribute("aria-label", text.modeButton);
    element("close-selection").setAttribute("aria-label", text.closeSelection);
  }

  function switchMode(modeId) {
    mode = modeId;
    saveMode(modeId);
    game = new Game({ mode });
    levels = game.levels;
    applyTexts(modeId);
    resetGame();
    toast(t("toastMode"));
  }

  function openHelp() {
    ui.helpOpen = true;
    ui.pendingMode = mode;
    applyTexts(mode);
    element("intro-modal").hidden = false;
    element("start-game").focus();
  }

  function closeIntro() {
    element("intro-modal").hidden = true;
    ui.helpOpen = false;
    if (ui.pendingMode !== mode) {
      ui.pendingMode = mode;
      applyTexts(mode);
    }
  }

  document.querySelectorAll(".mode-switch [data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.pendingMode = button.dataset.mode;
      applyTexts(ui.pendingMode);
      if (!runInProgress() && ui.pendingMode !== mode) {
        // Nothing to lose yet: switch straight away so the shop shows real prices.
        const wasHelp = ui.helpOpen;
        switchMode(ui.pendingMode);
        ui.helpOpen = wasHelp;
        ui.started = wasHelp;
        applyTexts(mode);
      }
    });
  });

  element("help-button").addEventListener("click", openHelp);
  element("mode-button").addEventListener("click", openHelp);
  element("start-game").addEventListener("click", () => {
    initAudio();
    const switching = ui.pendingMode !== mode;
    element("intro-modal").hidden = true;
    ui.helpOpen = false;
    if (switching) switchMode(ui.pendingMode);
    ui.started = true;
    ui.paused = false;
    accumulator = 0;
    canvas.focus();
    applyTexts(mode);
    updateHUD();
  });
  element("restart-game").addEventListener("click", () => {
    initAudio();
    resetGame();
    canvas.focus();
  });
  element("endless-game").addEventListener("click", () => {
    initAudio();
    if (!game.continueEndless()) return;
    element("end-modal").hidden = true;
    ui.endShown = false;
    accumulator = 0;
    processEvents();
    canvas.focus();
    updateHUD();
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (ui.helpOpen || !element("intro-modal").hidden) {
      if (event.key === "Escape" && ui.started) {
        closeIntro();
        canvas.focus();
      }
      return;
    }
    if (!element("end-modal").hidden) return;
    const key = event.key.toLowerCase();
    if (["1", "2", "3", "4", "5"].includes(key)) {
      selectBuildType(["falafel", "bulle", "glass", "espresso", "vind"][Number(key) - 1]);
    } else if (key === "escape") {
      ui.selectedType = null;
      ui.selectedTowerId = null;
      ui.hoveredPadId = null;
    } else if (key === "p") {
      togglePause();
    } else if (key === "f") {
      initAudio();
      if (resultFeedback(game.useFika())) processEvents();
    } else if (key === "+" || key === "=") {
      zoomAt({ x: view.width / 2, y: view.height / 2 }, 1.25);
    } else if (key === "-") {
      zoomAt({ x: view.width / 2, y: view.height / 2 }, 0.8);
    } else if (key === "0") {
      fitCamera();
    } else if (key === " " && !event.target.closest("button")) {
      event.preventDefault();
      startNextWave();
    }
    updateHUD();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && ui.started && !ui.paused && game.phase !== "won" && game.phase !== "lost") {
      ui.paused = true;
      accumulator = 0;
      updateHUD();
    }
  });
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(shell);

  function frame(timestamp) {
    const seconds = timestamp / 1000;
    const dt = lastFrame ? Math.min(0.1, seconds - lastFrame) : 0;
    lastFrame = seconds;
    const modalOpen = ui.helpOpen || !element("intro-modal").hidden || !element("end-modal").hidden;
    if (ui.started && !ui.paused && !modalOpen && game.phase !== "won" && game.phase !== "lost") {
      accumulator += dt * ui.speed;
      const fixedStep = 1 / 60;
      let steps = 0;
      while (accumulator >= fixedStep && steps < 14) {
        game.update(fixedStep);
        accumulator -= fixedStep;
        steps += 1;
      }
      ui.routePreview = ui.routePreview === Infinity ? Infinity : Math.max(0, ui.routePreview - dt);
    }
    processEvents();
    updateQuipSchedule();
    render(seconds, dt);
    updateHUD();
    requestAnimationFrame(frame);
  }

  loadMap();
  resize();
  fitCamera();
  applyTexts(mode);
  updateHUD();
  requestAnimationFrame(frame);

  // A small read-only-friendly handle makes browser smoke tests and debugging easy.
  window.stortorget = {
    get game() { return game; },
    get levels() { return levels; },
    get mode() { return mode; },
    setMode: switchMode,
    get camera() { return { ...camera }; },
    get ready() { return mapReady; },
    get effects() {
      return {
        quips: ui.quips.map((quip) => quip.text),
        shake: ui.shake,
        particles: ui.particles.length,
        recoil: ui.recoil.size,
        combo: { ...game.streak },
      };
    },
    startWave: startNextWave,
    reset: resetGame,
    step(seconds) {
      const steps = Math.ceil(seconds * 60);
      for (let index = 0; index < steps; index += 1) game.update(1 / 60);
      processEvents();
      updateQuipSchedule();
      updateHUD();
    },
    worldToScreen,
    fitCamera,
  };
})();
