(function () {
  "use strict";

  const levels = window.StortorgetLevels;
  const Game = window.StortorgetEngine.Game;
  const game = new Game();
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
    endShown: false,
    helpOpen: false,
  };

  const view = { width: 1, height: 1, dpr: 1, fitScale: 1 };
  const camera = { x: levels.MAP.width / 2, y: levels.MAP.height / 2, scale: 1 };
  let mapReady = false;
  let mapRender = null;
  let lastFrame = 0;
  let accumulator = 0;
  let toastTimer = 0;
  let audioContext = null;
  let soundEnabled = true;

  try {
    soundEnabled = localStorage.getItem("stortorget-sound") !== "off";
  } catch (_) {
    // The game also works with storage disabled (including some file:// modes).
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
      element("game-hint").textContent = "The local map could not be loaded";
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
      x: (point.x - camera.x) * camera.scale + view.width / 2,
      y: (point.y - camera.y) * camera.scale + view.height / 2,
    };
  }

  function screenToWorld(point) {
    return {
      x: (point.x - view.width / 2) / camera.scale + camera.x,
      y: (point.y - view.height / 2) / camera.scale + camera.y,
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

    beginWorldDraw();
    context.fillStyle = "#d9ddcf";
    context.fillRect(0, 0, levels.MAP.width, levels.MAP.height);
    if (mapReady) context.drawImage(mapRender, 0, 0);
    context.strokeStyle = "rgba(222, 245, 232, 0.35)";
    context.lineWidth = 1 / camera.scale;
    context.strokeRect(0, 0, levels.MAP.width, levels.MAP.height);

    if (ui.routePreview > 0) drawRoutes(time);
    drawRanges();
    context.restore();

    if (!mapReady) {
      context.fillStyle = "#dbe9e2";
      context.font = "600 14px -apple-system, sans-serif";
      context.textAlign = "center";
      context.fillText("Loading the real streets of Malmö…", view.width / 2, view.height / 2);
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
    context.save();
    context.translate(point.x, point.y);
    context.scale(clamp(camera.scale, 0.62, 1), clamp(camera.scale, 0.62, 1));
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

    context.save();
    context.rotate(tower.angle);
    context.strokeStyle = tower.type === "bulle" ? "#6d3d25" : "#264b41";
    context.lineWidth = tower.type === "bulle" ? 5 : 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(4, 0);
    context.lineTo(16, 0);
    context.stroke();
    context.restore();

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
    } else {
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
    }

    for (let index = 0; index < tower.level; index += 1) {
      context.fillStyle = "#ffe19a";
      context.beginPath();
      context.arc((index - (tower.level - 1) / 2) * 5, 17, 1.7, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawEnemy(enemy) {
    const point = worldToScreen(enemy);
    if (point.x < -35 || point.x > view.width + 35 || point.y < -35 || point.y > view.height + 35) return;
    const definition = levels.ENEMY_TYPES[enemy.type];
    const size = definition.size;
    const bob = reducedMotion ? 0 : Math.sin(game.elapsed * 8 + enemy.id * 1.7) * 0.9;
    const colors = {
      basic: "#d94f51",
      runner: "#ef735c",
      tank: "#a93746",
      boss: "#7e2639",
    };
    context.save();
    context.translate(point.x, point.y + bob);
    context.fillStyle = "rgba(0,0,0,.28)";
    context.beginPath();
    context.ellipse(1, size * 0.8, size * 0.85, size * 0.38, 0, 0, Math.PI * 2);
    context.fill();
    if (enemy.slowTimer > 0 || game.fikaRemaining > 0) {
      context.strokeStyle = "rgba(151, 225, 255, .9)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, size + 3, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = colors[enemy.type];
    context.strokeStyle = enemy.type === "boss" ? "#ffd166" : "rgba(255,255,255,.8)";
    context.lineWidth = enemy.type === "boss" ? 2.5 : 1;
    context.beginPath();
    context.arc(0, 0, size, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    // A tiny Dannebrog cross makes the attackers readable at any zoom level.
    context.strokeStyle = "#fff7ed";
    context.lineWidth = Math.max(1.5, size * 0.17);
    context.beginPath();
    context.moveTo(-size * 0.7, -size * 0.08);
    context.lineTo(size * 0.7, -size * 0.08);
    context.moveTo(-size * 0.18, -size * 0.72);
    context.lineTo(-size * 0.18, size * 0.72);
    context.stroke();

    if (enemy.type === "runner") {
      context.strokeStyle = "#ffe0ad";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-size * 0.8, -size * 0.65);
      context.lineTo(size * 0.8, -size * 0.9);
      context.stroke();
    }
    if (enemy.type === "boss") {
      context.fillStyle = "#ffd166";
      context.beginPath();
      context.moveTo(-10, -size + 1);
      context.lineTo(-9, -size - 9);
      context.lineTo(-3, -size - 3);
      context.lineTo(0, -size - 11);
      context.lineTo(4, -size - 3);
      context.lineTo(10, -size - 9);
      context.lineTo(10, -size + 1);
      context.closePath();
      context.fill();
    }

    if (enemy.hp < enemy.maxHp || enemy.type === "tank" || enemy.type === "boss") {
      const width = size * 2.2;
      const y = -size - (enemy.type === "boss" ? 17 : 8);
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
      context.save();
      context.shadowColor = projectile.type === "glass" ? "#9de5ff" : "#ffe2a6";
      context.shadowBlur = 7;
      context.fillStyle = levels.TOWER_TYPES[projectile.type].color;
      context.beginPath();
      context.arc(point.x, point.y, projectile.type === "bulle" ? 4.2 : 2.7, 0, Math.PI * 2);
      context.fill();
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
    const label = "KARL X GUSTAV";
    const width = context.measureText(label).width + 12;
    context.fillStyle = "rgba(10, 32, 27, .9)";
    context.beginPath();
    context.roundRect(-width / 2, 28, width, 17, 5);
    context.fill();
    context.fillStyle = "#f1f7ed";
    context.fillText(label, 0, 37);
    context.restore();
  }

  function drawEffects(dt) {
    for (const ring of ui.rings) {
      const point = worldToScreen(ring);
      const progress = 1 - ring.life / ring.maxLife;
      context.globalAlpha = ring.life / ring.maxLife;
      context.strokeStyle = ring.color;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(point.x, point.y, Math.max(2, ring.radius * camera.scale * progress), 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;

    for (const particle of ui.particles) {
      const origin = worldToScreen(particle);
      const age = particle.maxLife - particle.life;
      context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(origin.x + particle.vx * age, origin.y + particle.vy * age, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    for (const floater of ui.floaters) {
      const origin = worldToScreen(floater);
      const age = floater.maxLife - floater.life;
      context.globalAlpha = clamp(floater.life / floater.maxLife, 0, 1);
      context.fillStyle = floater.color;
      context.font = "800 11px -apple-system, sans-serif";
      context.textAlign = "center";
      context.shadowColor = "rgba(0,0,0,.8)";
      context.shadowBlur = 4;
      context.fillText(floater.text, origin.x, origin.y - age * 24);
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;

    if (game.fikaRemaining > 0) {
      context.fillStyle = `rgba(255, 221, 150, ${0.025 + Math.sin(game.elapsed * 3) * 0.01})`;
      context.fillRect(0, 0, view.width, view.height);
    }

    if (!reducedMotion) {
      ui.rings.forEach((ring) => { ring.life -= dt; });
      ui.particles.forEach((particle) => { particle.life -= dt; });
      ui.floaters.forEach((floater) => { floater.life -= dt; });
    } else {
      ui.rings.forEach((ring) => { ring.life -= dt * 3; });
      ui.particles.forEach((particle) => { particle.life -= dt * 3; });
      ui.floaters.forEach((floater) => { floater.life -= dt * 3; });
    }
    ui.rings = ui.rings.filter((ring) => ring.life > 0);
    ui.particles = ui.particles.filter((particle) => particle.life > 0);
    ui.floaters = ui.floaters.filter((floater) => floater.life > 0);
  }

  function render(time, dt) {
    drawMap(time);
    drawSpawnMarkers();
    drawBuildPads(time);
    game.towers.forEach(drawTower);
    game.enemies.slice().sort((a, b) => a.y - b.y).forEach(drawEnemy);
    drawProjectiles();
    drawStatue();
    drawEffects(dt);
  }

  function burst(x, y, color, count = 8) {
    if (reducedMotion) count = Math.min(2, count);
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
      const speed = 14 + Math.random() * 24;
      ui.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 8,
        color,
        size: 1.5 + Math.random() * 1.7,
        life: 0.7,
        maxLife: 0.7,
      });
    }
    if (ui.particles.length > 160) ui.particles.splice(0, ui.particles.length - 160);
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
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  }

  function tone(frequency, duration, delay = 0, volume = 0.035, type = "sine") {
    if (!soundEnabled || !audioContext) return;
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function playSound(name) {
    if (!soundEnabled || !audioContext) return;
    if (name === "build") {
      tone(330, 0.12, 0, 0.04, "triangle");
      tone(495, 0.16, 0.08, 0.03, "triangle");
    } else if (name === "upgrade") {
      tone(440, 0.12, 0, 0.035, "triangle");
      tone(660, 0.16, 0.08, 0.035, "triangle");
      tone(880, 0.2, 0.16, 0.025, "triangle");
    } else if (name === "wave") {
      tone(196, 0.22, 0, 0.05, "square");
      tone(294, 0.25, 0.17, 0.04, "square");
    } else if (name === "leak") {
      tone(130, 0.3, 0, 0.055, "sawtooth");
    } else if (name === "clear") {
      tone(392, 0.15, 0, 0.035, "triangle");
      tone(523, 0.2, 0.12, 0.035, "triangle");
    } else if (name === "fika") {
      tone(523, 0.2, 0, 0.03, "sine");
      tone(659, 0.3, 0.13, 0.03, "sine");
    } else if (name === "win") {
      [392, 494, 587, 784].forEach((note, index) => tone(note, 0.4, index * 0.15, 0.04, "triangle"));
    } else if (name === "lose") {
      [294, 247, 196].forEach((note, index) => tone(note, 0.35, index * 0.18, 0.04, "triangle"));
    }
  }

  function showEnd(won) {
    if (ui.endShown) return;
    ui.endShown = true;
    element("end-eyebrow").textContent = won ? "VICTORY · ALL 8 WAVES CLEARED" : "THE SQUARE WAS OVERRUN";
    element("end-title").textContent = won ? "Stortorget stands!" : "One more fika?";
    element("end-message").textContent = won
      ? "Karl X Gustav is still on his horse. Time for a well-earned fika."
      : `You reached wave ${game.currentWave}. Try covering the street merges, then slow the crowds with ice cream and fika.`;
    element("end-icon").textContent = won ? "♞" : "☕";
    element("end-kills").textContent = game.stats.kills;
    element("end-health").textContent = game.health;
    element("end-towers").textContent = game.stats.towersBuilt;
    element("end-modal").hidden = false;
    playSound(won ? "win" : "lose");
    element("restart-game").focus();
  }

  function processEvents() {
    for (const event of game.drainEvents()) {
      if (event.type === "build") {
        burst(event.x, event.y, levels.TOWER_TYPES[event.tower.type].color, 10);
        playSound("build");
      } else if (event.type === "upgrade") {
        burst(event.x, event.y, "#ffd166", 14);
        playSound("upgrade");
      } else if (event.type === "sell") {
        ui.floaters.push({ x: event.x, y: event.y, text: `+${event.refund} kr`, color: "#ffd166", life: 1, maxLife: 1 });
      } else if (event.type === "wave") {
        ui.routePreview = 6;
        toast(`Wave ${event.wave} · ${event.name}${event.earlyBonus ? ` · +${event.earlyBonus} kr early bonus` : ""}`);
        playSound("wave");
      } else if (event.type === "spawn" && event.enemy.type === "boss") {
        ui.routePreview = 3;
        toast("The final boss has arrived at Malmö Central!", true);
        playSound("wave");
      } else if (event.type === "kill") {
        burst(event.x, event.y, "#e66b62", 4);
        ui.floaters.push({ x: event.x, y: event.y, text: `+${event.bounty}`, color: "#ffe092", life: 0.8, maxLife: 0.8 });
        if (ui.floaters.length > 45) ui.floaters.shift();
      } else if (event.type === "explosion") {
        ui.rings.push({ x: event.x, y: event.y, radius: event.radius, color: "#ffc17c", life: 0.38, maxLife: 0.38 });
      } else if (event.type === "leak") {
        const vignette = element("damage-vignette");
        vignette.classList.remove("flash");
        void vignette.offsetWidth;
        vignette.classList.add("flash");
        toast(`The statue took ${event.damage} damage`, true);
        playSound("leak");
      } else if (event.type === "waveComplete") {
        ui.routePreview = Infinity;
        toast(`Wave cleared · +${event.reward} kr${event.healed ? " · statue repaired +1" : ""}`);
        playSound("clear");
      } else if (event.type === "fika") {
        toast("Fika break! The whole invasion slows down.");
        ui.rings.push({ x: levels.STATUE.x, y: levels.STATUE.y, radius: 160, color: "#ffe09a", life: 0.8, maxLife: 0.8 });
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
    setText("selection-kicker", `LEVEL ${tower.level} · ${Math.round(stats.range * 1.35)} m RANGE`);
    setText("selection-name", definition.name);
    const extras = stats.splash ? ` · ${stats.splash} splash` : stats.slowDuration ? ` · ${Math.round((1 - stats.slowFactor) * 100)}% slow` : "";
    setText("selection-stats", `${stats.damage} damage · ${stats.rate.toFixed(2)} s reload${extras}`);
    const upgrade = element("upgrade-button");
    const cost = game.getUpgradeCost(tower);
    upgrade.disabled = cost === null;
    upgrade.innerHTML = cost === null ? "Max level" : `Upgrade <span>${cost} kr</span>`;
    element("sell-button").innerHTML = `Sell <span>${Math.floor(tower.invested * game.config.sellRefund)} kr</span>`;
  }

  function updateHUD() {
    setText("health-value", game.health);
    setText("money-value", game.money);
    setText("wave-value", game.currentWave || "–");
    element("health-stat").classList.toggle("hurt", game.health <= 5);

    const remaining = game.enemies.length + game.spawnQueue.length;
    const chip = element("phase-chip");
    chip.classList.toggle("wave", game.phase === "wave");
    chip.classList.toggle("fika", game.fikaRemaining > 0);
    if (ui.started && ui.paused) chip.textContent = "PAUSED";
    else if (game.fikaRemaining > 0) chip.textContent = `FIKA BREAK · ${Math.ceil(game.fikaRemaining)} S`;
    else if (game.phase === "wave") chip.textContent = `WAVE ${game.currentWave} · ${remaining} LEFT`;
    else if (game.phase === "intermission") chip.textContent = `NEXT WAVE · ${Math.ceil(game.intermission)} S`;
    else if (game.phase === "won") chip.textContent = "STORTORGET STANDS";
    else if (game.phase === "lost") chip.textContent = "SQUARE OVERRUN";
    else chip.textContent = "BUILD PHASE";

    const shownWave = game.phase === "wave" ? game.getWave() : game.getNextWave();
    if (shownWave) {
      const number = game.phase === "wave" ? game.currentWave : game.currentWave + 1;
      setText("wave-eyebrow", game.phase === "wave" ? `WAVE ${number} OF ${levels.WAVES.length} · ${remaining} LEFT` : `NEXT UP · WAVE ${number}`);
      setText("wave-title", shownWave.name);
      const routeNames = shownWave.routes.map((routeId) => game.getRoute(routeId).name).join(" · ");
      setText("wave-routes", routeNames);
      element("wave-routes").title = routeNames;
    }

    const nextButton = element("next-wave");
    nextButton.disabled = game.phase !== "ready" && game.phase !== "intermission";
    if (game.phase === "intermission") {
      setText("next-wave-label", `Start wave ${game.currentWave + 1} · +${Math.ceil(game.intermission)} kr`);
      setText("next-wave-detail", `or auto-start in ${Math.ceil(game.intermission)} s`);
    } else if (game.phase === "ready") {
      setText("next-wave-label", "Start wave 1");
      setText("next-wave-detail", "No rush — prepare first");
    } else if (game.phase === "wave") {
      setText("next-wave-label", `${remaining} attackers left`);
      setText("next-wave-detail", "Hold the square");
    } else {
      setText("next-wave-label", game.phase === "won" ? "Malmö is safe" : "Run complete");
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
    if (game.fikaRemaining > 0) setText("fika-state", `ACTIVE · ${Math.ceil(game.fikaRemaining)} S`);
    else if (game.fikaCooldown > 0) setText("fika-state", `${Math.ceil(game.fikaCooldown)} S`);
    else setText("fika-state", "READY");

    const pause = element("pause-button");
    pause.textContent = ui.paused ? "▶" : "Ⅱ";
    pause.classList.toggle("active", ui.paused);
    pause.setAttribute("aria-label", ui.paused ? "Resume game" : "Pause game");
    setText("speed-button", `${ui.speed}×`);
    setText("sound-button", soundEnabled ? "♪" : "×");
    element("sound-button").classList.toggle("active", soundEnabled);
    element("sound-button").setAttribute("aria-label", soundEnabled ? "Mute sound" : "Enable sound");

    const hint = element("game-hint");
    if (!mapReady) hint.textContent = "Loading the map of Malmö…";
    else if (ui.started && ui.paused) hint.textContent = "Paused — press ▶ when you are ready";
    else if (ui.selectedType) hint.textContent = `Tap a white site to build ${levels.TOWER_TYPES[ui.selectedType].name} · Esc to cancel`;
    else if (!game.towers.length && game.phase === "ready") hint.textContent = "Pick a defence, then tap a white build site";
    else hint.textContent = "";

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
    if (!result.ok) toast(result.reason, true);
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

  function openHelp() {
    ui.helpOpen = true;
    element("intro-title").textContent = "How to hold Stortorget";
    element("start-game").innerHTML = "Back to the defence <span>→</span>";
    element("intro-modal").hidden = false;
    element("start-game").focus();
  }

  element("help-button").addEventListener("click", openHelp);
  element("start-game").addEventListener("click", () => {
    initAudio();
    element("intro-modal").hidden = true;
    ui.helpOpen = false;
    ui.started = true;
    ui.paused = false;
    accumulator = 0;
    canvas.focus();
    updateHUD();
  });
  element("restart-game").addEventListener("click", () => {
    initAudio();
    resetGame();
    canvas.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (ui.helpOpen || !element("intro-modal").hidden) {
      if (event.key === "Escape" && ui.started) {
        element("intro-modal").hidden = true;
        ui.helpOpen = false;
        canvas.focus();
      }
      return;
    }
    if (!element("end-modal").hidden) return;
    const key = event.key.toLowerCase();
    if (["1", "2", "3"].includes(key)) {
      selectBuildType(["falafel", "bulle", "glass"][Number(key) - 1]);
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
    render(seconds, dt);
    updateHUD();
    requestAnimationFrame(frame);
  }

  loadMap();
  resize();
  fitCamera();
  updateHUD();
  requestAnimationFrame(frame);

  // A small read-only-friendly handle makes browser smoke tests and debugging easy.
  window.stortorget = {
    game,
    levels,
    get camera() { return { ...camera }; },
    get ready() { return mapReady; },
    startWave: startNextWave,
    reset: resetGame,
    step(seconds) {
      const steps = Math.ceil(seconds * 60);
      for (let index = 0; index < steps; index += 1) game.update(1 / 60);
      processEvents();
      updateHUD();
    },
    worldToScreen,
    fitCamera,
  };
})();
