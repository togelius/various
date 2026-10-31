// SQUARE OFF — boot and game loop (owned by Render B / Integration).
// Fixed 20 Hz sim tick + render interpolation, slow-motion and hit-stop, tactical pause (orders still
// work while paused), wiring of render / camera / input / HUD / menus / tutorial / audio.
//
// SQ.game API (see js/core/contracts.js):
//   start(cfg) -> match     quit()     pause(bool?) -> paused     match  paused  speed  alpha
//   slowmo(seconds, scale)  time scale for juice (0.3 s at 0.3× on Crew Calls; reduced motion skips it)
//   hitStopping             true while a hit-stop freezes the frame (render reads it)
//   setSpeed(0.75|1|1.25)   cfgFromParams(URLSearchParams) -> cfg | null
// URL flags: ?skirmish=1&faction=hustle&seed=1[&opp=violets&ai=turtle&diff=regular&map=whole&events=normal]
//            ?quick[&crew=pack]   ?mission=m1   ?nav=1 (nav overlay)   ?q=low|med|high   ?nointro   ?paused
(function (SQ) {
  'use strict';
  const DT = (SQ.C && SQ.C.DT) || 0.05;

  function $(id) { return document.getElementById(id); }
  function call(obj, fn) {
    const args = Array.prototype.slice.call(arguments, 2);
    try { if (obj && typeof obj[fn] === 'function') return obj[fn].apply(obj, args); }
    catch (err) { console.error('[main]', fn, err); }
    return undefined;
  }

  const loading = {
    set(p, step) {
      const fill = $('loading-fill'); if (fill) fill.style.width = Math.round(p * 100) + '%';
      if (step) { const s = $('loading-step'); if (s) s.textContent = step; }
    },
    fact() {
      const facts = (SQ.data && SQ.data.text && SQ.data.text.loadingFacts) || [];
      const el = $('loading-fact');
      if (el && facts.length) el.textContent = facts[Math.floor(Math.random() * facts.length)];
    },
    done() {
      const el = $('loading'); if (!el) return;
      el.classList.add('done');
      setTimeout(() => el.classList.add('hidden'), 600);
    },
  };

  let audioDetach = null;
  const game = {
    match: null, paused: false, speed: 1, alpha: 0, running: false, hitStopping: false,
    _acc: 0, _last: 0, _raf: 0, _slow: 0, _slowScale: 1, _hitFrames: 0, _lastHitTick: -1, _autoPaused: false,
    start(cfg) {
      game.quit(true);
      let m;
      try { m = SQ.Match.create(cfg || {}); }
      catch (err) { console.error('[main] Match.create failed', err); return null; }
      game.match = m;
      game.paused = false;
      game._acc = 0; game._slow = 0; game._hitFrames = 0; game.hitStopping = false;
      call(SQ.render, 'setMatch', m);
      call(SQ.camera, 'setMatch', m);
      call(SQ.input, 'setMatch', m);
      call(SQ.hud, 'setMatch', m);
      call(SQ.tutorial, 'setMatch', m);
      call(SQ.audio, 'setMatch', m);
      if (SQ.audio && typeof SQ.audio.attach === 'function') {
        try {
          audioDetach = SQ.audio.attach(m.bus, { getState: () => m.state, match: m, player: m.state.player });
          const me = m.state.factions[m.state.player];
          call(SQ.audio, 'setMusic', 'calm', me ? me.key : undefined);
        } catch (err) { console.error('[main] audio.attach', err); }
      }
      if (/[?&]paused/.test(location.search)) game.pause(true);
      if (SQ.bus) SQ.bus.emit('gameStart', { match: m });
      return m;
    },
    quit(silent) {
      if (!game.match) return;
      const m = game.match;
      game.match = null;
      game.paused = false;
      if (audioDetach) { try { audioDetach(); } catch (e) { /* */ } audioDetach = null; }
      call(SQ.render, 'setMatch', null);
      call(SQ.camera, 'setMatch', null);
      call(SQ.input, 'setMatch', null);
      call(SQ.hud, 'setMatch', null);
      call(SQ.tutorial, 'setMatch', null);
      call(SQ.audio, 'setMatch', null);
      if (!silent) call(SQ.audio, 'setMusic', 'menu');
      if (!silent && SQ.bus) SQ.bus.emit('gameQuit', { match: m });
    },
    pause(on) {
      const next = on === undefined ? !game.paused : !!on;
      if (next === game.paused) return game.paused;
      game.paused = next;
      game._autoPaused = false;
      if (SQ.render) call(SQ.render, 'invalidate');
      if (SQ.audio && SQ.audio.play) try { SQ.audio.play('pause'); } catch (e) { /* */ }
      if (SQ.bus) SQ.bus.emit('gamePause', { paused: game.paused });
      return game.paused;
    },
    slowmo(sec, scale) {
      if (SQ.render && SQ.render.options && SQ.render.options.reducedMotion) return;
      game._slow = Math.max(game._slow, sec || 0.3);
      game._slowScale = Math.min(game._slow > 0 ? game._slowScale : 1, scale || 0.3);
    },
    setSpeed(s) { if (s === 0.75 || s === 1 || s === 1.25) game.speed = s; return game.speed; },
    cfgFromParams,
  };
  SQ.game = game;

  // ---------------------------------------------------------------- loop
  function frame(now) {
    game._raf = requestAnimationFrame(frame);
    const real = Math.min(0.25, Math.max(0, (now - (game._last || now)) / 1000));
    game._last = now;
    const m = game.match;
    const intro = SQ.camera && SQ.camera.inIntro;
    if (m && !game.paused && !m.state.over && !intro) {
      if (game._hitFrames > 0) { game._hitFrames--; game.hitStopping = true; }
      else {
        game.hitStopping = false;
        let scale = game.speed;
        if (game._slow > 0) { scale *= game._slowScale; game._slow -= real; if (game._slow <= 0) game._slowScale = 1; }
        game._acc += real * scale;
        let steps = 0;
        while (game._acc >= DT && steps < 8) {
          m.tick(DT); game._acc -= DT; steps++;
          if (m.state.hitStop > 0 && m.state.tick !== game._lastHitTick) {
            game._lastHitTick = m.state.tick;
            if (!(SQ.render && SQ.render.options && SQ.render.options.reducedMotion)) { game._hitFrames = Math.max(game._hitFrames, m.state.hitStop | 0); break; }
          }
          if (m.state.over) break;
        }
        if (steps === 8) game._acc = 0;
      }
    } else if (m && m.state.over) {
      // let the final victory slow-mo play out visually
      game._acc = Math.min(DT, game._acc + real * 0.25);
      if (game._slow > 0) game._slow -= real;
    }
    game.alpha = m ? Math.min(1, game._acc / DT) : 0;
    call(SQ.camera, 'update', real);
    call(SQ.input, 'update', real);
    call(SQ.render, 'frame', m ? m.state : null, game.alpha, real);
    call(SQ.hud, 'update', m, real);
    call(SQ.tutorial, 'update', real);
  }

  // ---------------------------------------------------------------- URL → match cfg
  function cfgFromParams(params) {
    params = params || new URLSearchParams(location.search);
    const crews = (SQ.C && SQ.C.FACTIONS) || ['hustle', 'noise', 'violets', 'pack'];
    const seedParam = params.get('seed');
    const seed = seedParam !== null && seedParam !== '' ? (parseInt(seedParam, 10) >>> 0) : (Date.now() >>> 0);
    const rng = SQ.util.mulberry32(seed ^ 0x5bd1e995);
    if (params.get('mission')) {
      const mid = params.get('mission');
      const mis = SQ.data.missionById && SQ.data.missionById[mid];
      if (mis) {
        const crews = (SQ.C && SQ.C.FACTIONS) || ['hustle', 'noise', 'violets', 'pack'];
        const mine = mis.player && mis.player !== 'pick' ? mis.player : (crews.indexOf(params.get('crew')) >= 0 ? params.get('crew') : 'hustle');
        const pool = crews.filter((c) => c !== mine);
        const players = [{ faction: mine, ai: false }];
        for (const o of mis.opponents || []) {
          const f = o.faction && o.faction !== 'pick' ? o.faction : pool.shift();
          players.push({ faction: f, ai: { personality: o.personality || 'turtle', difficulty: o.difficulty || 'regular' } });
        }
        return { missionId: mid, seed, players };
      }
    }
    const isSkirmish = params.has('skirmish') || params.has('quick') || params.has('faction') || params.has('crew');
    if (!isSkirmish) return null;
    let me = params.get('faction') || params.get('crew');
    if (crews.indexOf(me) < 0) me = crews[Math.floor(rng() * crews.length)];
    const nOpp = Math.max(1, Math.min(3, parseInt(params.get('opponents') || '1', 10) || 1));
    const others = crews.filter((c) => c !== me);
    const players = [{ faction: me, ai: false, assist: params.has('assist') ? params.get('assist') !== '0' : undefined }];
    const optOpp = params.get('opp');
    for (let k = 0; k < nOpp; k++) {
      let f = k === 0 && optOpp && crews.indexOf(optOpp) >= 0 && optOpp !== me ? optOpp : others.splice(Math.floor(rng() * others.length), 1)[0];
      if (!f) f = crews.filter((c) => c !== me)[k % 3];
      const fd = SQ.data.factions[f] || {};
      players.push({ faction: f, ai: { personality: params.get('ai') || fd.aiPersonality || 'turtle', difficulty: params.get('diff') || 'regular' } });
    }
    const cfg = { mapId: params.get('map') || 'whole', seed, players };
    if (params.get('events')) cfg.events = params.get('events');
    if (params.get('turf')) cfg.turfTarget = parseInt(params.get('turf'), 10) || undefined;
    if (params.has('noai')) cfg.ai = false;
    if (params.get('start')) cfg.startClock = { afternoon: 0, golden: 200, night: 400 }[params.get('start')] || parseInt(params.get('start'), 10) || 0;
    return cfg;
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    loading.fact();
    loading.set(0.08, 'Reading the park…');
    if (!window.GEO || !SQ.Match || typeof THREE === 'undefined') {
      const el = document.createElement('div');
      el.className = 'fatal';
      el.textContent = 'SQUARE OFF failed to load its park data.';
      document.body.appendChild(el);
      return;
    }
    setTimeout(() => {
      try { SQ.nav.get(window.GEO); } catch (err) { console.error(err); }
      loading.set(0.3, 'Planting 417 trees…');
      setTimeout(() => {
        const view = $('view');
        let ok = true;
        if (SQ.render && typeof SQ.render.init === 'function') {
          try { ok = SQ.render.init(view, { onProgress: (p, step) => loading.set(0.3 + p * 0.65, step) }) !== false; }
          catch (err) { console.error('[main] render.init', err); }
        }
        if (!ok) return;
        call(SQ.camera, 'init', view);
        call(SQ.input, 'init', view);
        call(SQ.hud, 'init', $('hud'), game);
        call(SQ.tutorial, 'init', $('hud'));
        call(SQ.audio, 'init');
        loading.set(1, 'Park is open.');
        loading.done();
        game._raf = requestAnimationFrame(frame);
        const params = new URLSearchParams(location.search);
        const hasMenus = SQ.menus && typeof SQ.menus.init === 'function';
        // Menus own ?mission= (briefings, stars) and the first-launch drop into Mission 1.
        const cfg = hasMenus && params.has('mission') ? null : cfgFromParams(params);
        if (hasMenus) call(SQ.menus, 'init', $('menu'));   // subscribes to victory → Park Report
        if (cfg) game.start(cfg);                          // URL skirmish: straight into the match
        else if (!hasMenus) game.start(cfgFromParams(new URLSearchParams('quick=1')));
      }, 0);
    }, 0);

    // Auto-pause when the tab is hidden (unless already paused); resume on return.
    document.addEventListener('visibilitychange', () => {
      if (!game.match || game.match.state.over) return;
      if (document.hidden && !game.paused) { game.pause(true); game._autoPaused = true; }
      else if (!document.hidden && game._autoPaused) { game.pause(false); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.SQ = window.SQ || {});
