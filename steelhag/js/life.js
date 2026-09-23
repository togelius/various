'use strict';

// Small things to notice, or pass by. Nothing here gates the journey.
const QUIET_PLACES = [
  [{ kind: 'radio', x: 1370, label: 'turn the dial' }],
  [{ kind: 'birds', x: 2310, label: 'whistle softly' }],
  [{ kind: 'water', x: 810, label: 'skip a stone', waterX: 960, waterY: 638 },
    { kind: 'bell', x: 3500, label: 'ring the little bell' }],
  [{ kind: 'signal', x: 1290, label: 'try the switch' }],
  [{ kind: 'stones', x: 2960, label: 'let a pebble go' }],
  // years later, something has moved into the place where the machine was
  [{ kind: 'birds', x: 3620, label: 'whistle softly' }],
];

class QuietLife {
  constructor(world) {
    this.world = world;
    this.chapter = world.L.id - 1;
    this.time = 0;
    this.events = [];
    this.places = (QUIET_PLACES[this.chapter] || []).map(p => ({
      ...p, y: world.surfaceAt(p.x), age: 100, cooldown: 0, count: 0,
      waiting: 0, settled: false, on: false, answer: false,
    }));
    const r = rng32(world.L.seed + 407);
    this.drift = Array.from({ length: 16 }, () => ({
      x: r() * world.W, y: 380 + r() * 150, phase: r() * TAU,
      speed: 4 + r() * 7, size: 1.5 + r() * 2,
    }));
    // Reused soft discs; no blur filter or large canvas allocations per frame.
    this.disc = makeCanvas(48, 48);
    const g = this.disc.getContext('2d'), grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, 'rgba(255,237,203,0.45)');
    grad.addColorStop(0.65, 'rgba(255,237,203,0.3)');
    grad.addColorStop(1, 'rgba(255,237,203,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 48, 48);
  }

  near(player) {
    if (!player.onGround) return null;
    return this.places.find(p => Math.abs(player.x - p.x) < 64 && Math.abs(player.y - p.y) < 48) || null;
  }

  interact(player) {
    const p = this.near(player);
    if (!p || p.cooldown > 0) return false;
    p.age = 0; p.count++; p.answer = false;
    p.cooldown = p.kind === 'water' ? 6 : p.kind === 'stones' ? 10 : p.kind === 'birds' ? 12 : 2;
    if (p.kind === 'radio') p.channel = (p.count - 1) % 3;
    if (p.kind === 'signal') p.on = !p.on;
    if (p.kind === 'birds') { p.settled = true; p.startled = false; p.visitorX = player.x - p.x; }
    this.events.push({ kind: p.kind, x: p.x, channel: p.channel, on: p.on });
    return true;
  }

  update(dt, player, active = true) {
    this.time += dt;
    for (const p of this.places) {
      const before = p.age;
      p.age += dt; p.cooldown = Math.max(0, p.cooldown - dt);
      const close = active && player.onGround && Math.abs(player.x - p.x) < 150 && Math.abs(player.y - p.y) < 60;
      // Waiting is a second way to meet the birds: they settle beside you.
      if (p.kind === 'birds') {
        p.waiting = close && Math.abs(player.vx) < 8 ? p.waiting + dt : 0;
        if (close && Math.abs(player.vx) > 90 && p.cooldown === 0) {
          p.startled = true; p.settled = false; p.age = 0; p.cooldown = 8;
          this.events.push({ kind: 'flutter', x: p.x });
        }
        if (!p.settled && p.waiting > 3.5 && p.cooldown === 0) {
          p.settled = true; p.startled = false; p.visitorX = player.x - p.x; p.age = 0; p.cooldown = 12;
          this.events.push({ kind: 'birds', x: p.x, gentle: true });
        }
        if (p.settled && p.age > 18 && !close) p.settled = false;
      }
      if (!p.count) continue;
      // The reply comes after enough silence to wonder if anything happened.
      const delay = p.kind === 'bell' ? 3.6 : p.kind === 'radio' && p.channel === 2 ? 4.8 : 0;
      if (delay && before < delay && p.age >= delay && !p.answer) {
        p.answer = true;
        if (active && Math.abs(player.x - p.x) < 850)
          this.events.push({ kind: 'answer', x: p.x, bell: p.kind === 'bell' });
      }
      if (p.kind === 'water') {
        for (const t of [0.65, 1.15, 1.55]) if (before < t && p.age >= t && active && Math.abs(player.x - p.x) < 700)
          this.events.push({ kind: 'drop', x: p.x });
      }
    }
  }

  // Something worth the machine's attention: a reply, birds lifting, lights coming on.
  interest() {
    for (const p of this.places) {
      if (p.kind === 'birds' && (p.startled || p.settled) && p.age < 6) return { x: p.x + (p.startled ? 60 + p.age * 30 : 0), y: p.y - (p.startled ? 40 + p.age * 20 : 8) };
      if (p.count && p.age < 5) return { x: p.kind === 'signal' ? p.x + 45 + Math.min(4, p.age / 0.45) * 40 : p.kind === 'water' ? p.waterX : p.x, y: p.kind === 'signal' ? p.y - 60 : p.y - 30 };
    }
    return null;
  }

  drainSounds(playerX) {
    const out = this.events.filter(e => Math.abs(e.x - playerX) < 850);
    this.events = [];
    return out;
  }

  bird(g, x, y, t, size, perched = false) {
    g.beginPath();
    if (perched) {
      g.ellipse(x, y - 2, size * 0.65, size * 0.4, -0.2, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(x + size * 0.4, y - 3); g.lineTo(x + size, y - 2); g.lineTo(x + size * 0.4, y - 1); g.fill();
    } else {
      const wing = Math.sin(t * 6) * size * 0.6;
      g.moveTo(x - size, y - wing); g.quadraticCurveTo(x - size * 0.4, y - 3, x, y);
      g.quadraticCurveTo(x + size * 0.4, y - 3, x + size, y - wing); g.stroke();
    }
  }

  drawDistant(g, cam) {
    const t = this.time;
    g.save();
    // One loose flock, taking well over a minute to cross the landscape.
    if (this.chapter < 3 || this.chapter === 5) {
      g.strokeStyle = css(mix('#424952', this.world.L.pal.haze, 0.35), 0.45); g.lineWidth = 1;
      const x = ((t * 12 + this.chapter * 510) % 2600) - 500 - cam.x * 0.13;
      for (let i = 0; i < 5; i++) this.bird(g, x + i * 22, 315 - cam.y * 0.13 + Math.sin(i * 2) * 14, t + i, 3);
    }
    for (const p of this.places) {
      if (p.kind !== 'radio') continue;
      const x = (p.x - cam.x) * 0.13 + 620, y = 400 - cam.y * 0.13;
      g.strokeStyle = css('#667078', 0.28); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y + 50); g.lineTo(x, y); g.stroke();
      if (!p.answer || p.age > 9) continue;
      g.globalAlpha = Math.max(0, Math.sin((p.age - (p.kind === 'bell' ? 3.6 : 4.8)) * 2)) * 0.22;
      g.drawImage(this.disc, x - 8, y - 8, 16, 16);
    }
    g.restore();
  }

  draw(g, cam) {
    g.save();
    const t = this.time;
    for (const p of this.places) {
      const x = p.x - cam.x, y = p.y - cam.y, a = p.age;
      if (x < -450 || x > VIEW_W + 250) continue;
      g.strokeStyle = '#524f47'; g.fillStyle = '#524f47'; g.lineWidth = 1.5;
      if (p.kind === 'radio') {
        // A weathered receiver tied to a surveying stake.
        g.fillStyle = '#696453'; g.fillRect(x - 3, y - 32, 6, 33);
        g.fillStyle = '#969283'; g.fillRect(x - 15, y - 49, 30, 20);
        g.fillStyle = '#464d4a'; g.fillRect(x - 11, y - 45, 15, 11);
        g.fillStyle = '#bdb7a0'; g.beginPath(); g.arc(x + 9, y - 37, 3, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(x + 11, y - 49); g.lineTo(x + 16, y - 77); g.stroke();
        if (p.count && a < 7) {
          g.fillStyle = css(p.channel === 2 ? '#cde2cc' : '#edc185', (0.5 + Math.sin(a * 9) * 0.25) * (1 - smooth(5, 7, a)));
          g.fillRect(x - 10, y - 44, 12, 2);
        }
      } else if (p.kind === 'birds') {
        // An abandoned gearbox has become a nest.
        g.strokeStyle = '#80704c';
        for (let i = 0; i < 8; i++) {
          g.beginPath(); g.ellipse(x, y - 2 - (i % 3), 12 + i % 4, 3, i * 0.15, 0, Math.PI); g.stroke();
        }
        g.fillStyle = '#444a37'; g.strokeStyle = '#444a37';
        for (let i = 0; i < 3; i++) {
          const flight = p.startled ? smooth(0, 1.5, a) * (1 - smooth(5, 8, a)) : p.settled ? Math.sin(Math.min(1, a / (3 + i * 0.3)) * Math.PI) : 0;
          const visit = p.settled ? smooth(0, 3 + i * 0.3, a) : 0;
          const bx = x + (i - 1) * 11 + flight * (80 + i * 22) + visit * (p.visitorX || 0) * 0.65;
          const by = y - 5 - flight * (45 + i * 13);
          this.bird(g, bx, by, t + i, 4, flight < 0.01);
        }
      } else if (p.kind === 'water') {
        for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x - 12 + i * 5, y - 2, 3, 1.7, i, 0, TAU); g.fill(); }
        const wx = p.waterX - cam.x, wy = p.waterY - cam.y;
        if (p.count && a < 4) {
          // Three diminishing hops, then widening rings.
          const stops = [0, 0.65, 1.15, 1.55];
          for (let i = 1; i < stops.length; i++) {
            const age = a - stops[i];
            if (age >= 0 && age < 2.2) {
              g.strokeStyle = css('#d8d0c0', (1 - age / 2.2) * 0.5);
              g.beginPath(); g.ellipse(wx + (i - 1) * 51, wy, 3 + age * 19, 1 + age * 3, 0, 0, TAU); g.stroke();
            }
            if (a >= stops[i - 1] && a < stops[i]) {
              const u = (a - stops[i - 1]) / (stops[i] - stops[i - 1]);
              const sx = i === 1 ? x : wx + (i - 2) * 51, sy = i === 1 ? y - 22 : wy;
              g.fillStyle = '#59574f'; g.beginPath();
              g.arc(lerp(sx, wx + (i - 1) * 51, u), lerp(sy, wy, u) - Math.sin(u * Math.PI) * (35 / i), 2, 0, TAU); g.fill();
            }
          }
        }
      } else if (p.kind === 'bell') {
        g.fillStyle = '#4b443b'; g.fillRect(x - 3, y - 66, 6, 66); g.fillRect(x - 4, y - 67, 26, 4);
        g.save(); g.translate(x + 17, y - 62); g.rotate(p.count ? Math.sin(a * 8) * Math.exp(-a * 0.7) * 0.25 : 0);
        g.fillStyle = '#93846a'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-10, 15); g.quadraticCurveTo(0, 19, 10, 15); g.lineTo(5, 0); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(0, 17); g.lineTo(0, 38); g.stroke(); g.restore();
      } else if (p.kind === 'signal') {
        g.fillStyle = '#424d50'; g.fillRect(x - 11, y - 39, 22, 40);
        g.strokeStyle = '#d4be84'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x + (p.on ? 5 : -5), y - 30); g.stroke();
        g.strokeStyle = css('#626869', 0.6); g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y - 39); g.quadraticCurveTo(x + 100, y - 48, x + 205, y - 74); g.stroke();
        for (let i = 0; i < 5; i++) {
          const lx = x + 45 + i * 40, ly = y - 50 - i * 6;
          const lit = p.on && a > 0.3 + i * 0.45;
          g.fillStyle = lit ? '#e7bf81' : '#666455'; g.fillRect(lx - 2, ly, 4, 6);
          if (lit) { g.globalAlpha = 0.42; g.drawImage(this.disc, lx - 17, ly - 14, 34, 34); g.globalAlpha = 1; }
        }
      } else if (p.kind === 'stones') {
        for (let i = 0; i < 5; i++) {
          const lift = p.count ? Math.sin(Math.min(1, a / 10) * Math.PI) * (20 + i * 11) : Math.sin(t * 0.8 + i) * 1.2;
          const px = x + (i - 2) * 8, py = y - 3 - lift;
          g.fillStyle = css('#535665', 0.18); g.beginPath(); g.ellipse(px, y + 1, 4, 1.2, 0, 0, TAU); g.fill();
          g.fillStyle = '#7d7a86'; g.beginPath(); g.ellipse(px + Math.sin(t + i) * lift * 0.04, py, 3, 2, i + lift * 0.03, 0, TAU); g.fill();
        }
      }
    }
    // Sparse seasonal motion in the middle distance, plus tiny water rings.
    for (const d of this.drift) {
      const x = d.x - cam.x * 0.6 + Math.sin(t * 0.18 + d.phase) * 16;
      if (x < -30 || x > VIEW_W + 30) continue;
      if (this.chapter === 1) {
        const y = d.y - cam.y * 0.6 + ((t * d.speed + d.phase * 40) % 140);
        g.fillStyle = css('#d9bd70', 0.38); g.save(); g.translate(x, y); g.rotate(t * 0.5 + d.phase);
        g.beginPath(); g.ellipse(0, 0, d.size, d.size * (0.2 + Math.abs(Math.sin(t + d.phase)) * 0.4), 0, 0, TAU); g.fill(); g.restore();
      } else if (this.chapter === 2) {
        const age = (t * 0.35 + d.phase) % 3;
        g.strokeStyle = css('#c9c5b5', 0.12 * (1 - age / 3));
        g.beginPath(); g.ellipse(x, 655 - cam.y + d.phase * 5, 2 + age * 8, 1 + age * 1.4, 0, 0, TAU); g.stroke();
      } else if (this.chapter === 3) {
        const age = (t * 0.12 + d.phase) % 1;
        g.globalAlpha = Math.sin(age * Math.PI) * 0.055;
        g.drawImage(this.disc, x, 510 - cam.y * 0.6 - age * 80, 36 + age * 40, 25 + age * 45); g.globalAlpha = 1;
      }
    }
    g.restore();
  }

  drawForeground(g, cam) {
    // Only a few close motes catch the light; deliberately well below HUD contrast.
    if (this.chapter !== 1 && this.chapter !== 3) return;
    g.save();
    for (let i = 0; i < 7; i++) {
      const x = ((i * 397 - cam.x * 1.18 + Math.sin(this.time * 0.2 + i) * 18) % 1900 + 1900) % 1900 - 200;
      const y = 665 + Math.sin(i * 8 + this.time * 0.11) * 40;
      const size = 12 + i % 3 * 6;
      g.globalAlpha = (this.chapter === 3 ? 0.055 : 0.09) * (0.7 + Math.sin(this.time * 0.3 + i) * 0.3);
      g.drawImage(this.disc, x, y, size, size);
    }
    g.restore();
  }
}
