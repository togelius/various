// Accessible pause controls. Native form elements work with keyboard, touch and screen readers.
'use strict';
const SETTINGS = (() => {
  const defaults = Object.freeze({ sensitivity: 1, aimSensitivity: .75, invertY: false,
    mouseAssist: false, controllerAssist: true, cameraShake: .65, speedFov: .8,
    steeringAssist: .35, hudScale: 1, bloom: true, resolution: 1.25, shadows: true,
    auto: true, edges: true, bindings: {} });
  const actions = { KeyW:'Forward / accelerate', KeyS:'Back / brake', KeyA:'Left', KeyD:'Right',
    ShiftLeft:'Sprint', Space:'Jump / vault / handbrake', KeyF:'Enter / exit vehicle',
    KeyC:'Aim', ControlLeft:'Fire', KeyR:'Reload / radio', KeyQ:'Previous weapon',
    KeyE:'Next weapon', KeyZ:'Crouch', KeyX:'Evade', KeyV:'Switch shoulder' };
  let root, wasOpen = false, capture = null;
  const keyName = code => code.replace(/^Key|^Digit/, '').replace('Left', ' (left)').replace('Right', ' (right)');
  function sanitize(o) {
    for (const [key, min, max] of [['sensitivity',.3,3],['aimSensitivity',.2,1.5],['cameraShake',0,1],['speedFov',0,1],['steeringAssist',0,1],['hudScale',.8,1.3],['resolution',.75,1.5]]) {
      o[key] = Number.isFinite(o[key]) ? Math.min(max,Math.max(min,o[key])) : defaults[key];
    }
    for (const key of ['invertY','mouseAssist','controllerAssist','bloom','shadows','auto','edges']) if (typeof o[key] !== 'boolean') o[key] = defaults[key];
    const bindings = {}, used = new Set();
    for (const key of Object.keys(actions)) { const value = o.bindings && o.bindings[key]; if (typeof value === 'string' && /^(Key[A-Z]|Space|ShiftLeft|ControlLeft|AltLeft)$/.test(value) && !['KeyM','KeyP','KeyT','KeyH','KeyL','KeyY','KeyN','KeyG','AltLeft'].includes(value) && !used.has(value)) { bindings[key] = value; used.add(value); } }
    o.bindings = bindings;
    return o;
  }
  function bind(action, physical) {
    const bindings = GAME.options.bindings, old = bindings[action] || action;
    for (const key of Object.keys(actions)) if (key !== action && (bindings[key] || key) === physical) bindings[key] = old;
    bindings[action] = physical;
    GAME.saveOptions();
  }
  function build() {
    root = document.createElement('section'); root.id = 'settings'; root.hidden = true;
    root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-label','Pause and settings');
    root.innerHTML = '<div class="settings-card"><header><div><small>GRIFT CITY</small><h1>Take a breath.</h1></div><button id="settings-resume">Resume game</button></header><p id="settings-status"></p><div class="settings-grid"></div><footer><button id="settings-reset">Restore controls &amp; display defaults</button><button id="settings-new">New game</button><span>Esc to resume · Changes save automatically</span></footer></div>';
    document.body.appendChild(root);
    const grid = root.querySelector('.settings-grid');
    const groups = [
      ['Camera & comfort', [['sensitivity','Look sensitivity',.3,3,.1],['aimSensitivity','Aim sensitivity',.2,1.5,.05],['cameraShake','Camera shake',0,1,.05],['speedFov','Speed / sprint FOV effect',0,1,.1],['hudScale','HUD & text scale',.8,1.3,.05],['invertY','Invert vertical look'],['mouseAssist','Mouse aim assistance'],['controllerAssist','Controller / touch aim assistance'],['steeringAssist','Countersteer assistance',0,1,.05]]],
      ['Picture & sound', [['resolution','Render scale',.75,1.5,.25],['shadows','Sun shadows'],['bloom','Bloom & tone mapping'],['edges','Illustrated outlines'],['auto','Adaptive quality'],['muted','Mute all sound']]]
    ];
    for (const [name, rows] of groups) {
      const section = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = name; section.appendChild(legend);
      for (const [key,label,min,max,step] of rows) {
        const row = document.createElement('label'); row.className = 'setting-row';
        const text = document.createElement('span'); text.textContent = label; row.appendChild(text);
        const control = document.createElement('input'); control.dataset.option = key;
        if (min !== undefined) { control.type = 'range'; control.min=min; control.max=max; control.step=step; } else control.type = 'checkbox';
        control.addEventListener('input', () => { if (key === 'muted') { if (control.checked !== AUDIO.muted) AUDIO.toggleMute(); } else { GAME.options[key] = control.type === 'checkbox' ? control.checked : Number(control.value); GAME.saveOptions(); } refresh(); });
        row.appendChild(control); const output=document.createElement('output'); row.appendChild(output); section.appendChild(row);
      }
      grid.appendChild(section);
    }
    const field = document.createElement('fieldset'); field.className = 'bindings'; field.innerHTML='<legend>Keyboard controls</legend><p>Select a control, then press a key. Conflicts swap bindings. Escape cancels. M/P/T/H/L/Y/N/G and Alt keep their contextual actions.</p>';
    for (const [key,label] of Object.entries(actions)) {
      const row=document.createElement('div'); row.className='binding-row'; const name=document.createElement('span'); name.textContent=label;
      const button=document.createElement('button'); button.dataset.binding=key; button.setAttribute('aria-label',label+' binding');
      button.addEventListener('click',()=>{capture=key; button.textContent='Press a key…';}); row.append(name,button); field.appendChild(row);
    }
    grid.appendChild(field);
    root.querySelector('#settings-resume').onclick = resume;
    root.querySelector('#settings-new').onclick = () => GAME.askNewGame();
    root.querySelector('#settings-reset').onclick = () => { Object.assign(GAME.options, defaults, {bindings:{}}); GAME.saveOptions(); refresh(); };
    // Do not let form interactions become shots, menu shortcuts, or pointer-lock requests.
    for (const event of ['mousedown','mouseup','mousemove','wheel','touchstart','touchend']) root.addEventListener(event,e=>e.stopPropagation());
    window.addEventListener('keydown', e => {
      if (!wasOpen) return;
      e.stopImmediatePropagation();
      if (capture) {
        e.preventDefault();
        if (e.code === 'Escape') capture=null;
        else if (/^(Key[A-Z]|Space|ShiftLeft|ControlLeft|AltLeft)$/.test(e.code) && !['KeyM','KeyP','KeyT','KeyH','KeyL','KeyY','KeyN','KeyG','AltLeft'].includes(e.code)) { bind(capture,e.code); capture=null; }
        refresh();
      } else if (e.code === 'Escape') { e.preventDefault(); resume(); }
      else if (e.code === 'KeyN') { e.preventDefault(); GAME.askNewGame(); }
      else if (e.code === 'Tab') {
        const list=[...root.querySelectorAll('button,input')], index=list.indexOf(document.activeElement);
        if (e.shiftKey && index<=0) {e.preventDefault();list[list.length-1].focus();}
        else if (!e.shiftKey && index===list.length-1) {e.preventDefault();list[0].focus();}
      }
    },true);
  }
  function refresh() {
    for (const input of root.querySelectorAll('[data-option]')) {
      const key=input.dataset.option, value=key==='muted'?AUDIO.muted:GAME.options[key];
      if (input.type==='checkbox') input.checked=value; else input.value=value;
      input.nextElementSibling.textContent=input.type==='checkbox'?'':Number(value).toFixed(2);
    }
    for (const button of root.querySelectorAll('[data-binding]')) if (capture!==button.dataset.binding) button.textContent=keyName(GAME.options.bindings[button.dataset.binding]||button.dataset.binding);
    const p=PLAYER.P;
    root.querySelector('#settings-status').textContent=`${W.clockString()} · $${p.money.toLocaleString()} · ${p.stats.missions} missions passed · ${(p.stats.distance/1000).toFixed(1)} km travelled · ${GAME.fps || '—'} fps`;
  }
  function resume() { capture=null; GAME.state='playing'; sync('playing'); INPUT.releaseAll(); INPUT.requestLock(); }
  function sync(state) {
    const open=state==='paused'; if (!root && open) build();
    if (open && root) root.querySelector('#settings-new').textContent=GAME.wipeArmed?'Press again to erase save':'New game';
    if (open===wasOpen) return;
    wasOpen=open; root.hidden=!open; capture=null;
    if (open) { INPUT.releaseAll(); refresh(); root.querySelector('#settings-resume').focus(); }
  }
  return { defaults, actions, sanitize, bind, sync, keyName };
})();
