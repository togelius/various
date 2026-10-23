// ui.js: identical game chrome for both views, so the play area is the same size.
// Top bar 40 CSS px; bottom: a two-row proximity strip (60 px) plus an action bar (52 px).
(function (root) {
  'use strict';
  // Capture the viewport before anything is drawn: on mobile emulation an over-wide canvas
  // would otherwise make the layout viewport grow to fit it.
  const UI = { TOP: 40, BOTTOM: 112, VW: document.documentElement.clientWidth, VH: document.documentElement.clientHeight };
  // Shared palette (sRGB hex). Both renderers use these, so the comparison is about projection.
  UI.PAL = {
    floorA: '#a8957a', floorB: '#9f8c70', wallCap: '#3a3f3c', wallFace: '#6f7d74', wallFaceE: '#5d6a62',
    column: '#e6e0d4', columnLine: '#6b665c', plinth: '#d9d2c3', lowPlinth: '#e6dfd0', statue: '#f4f1ea',
    vitrineBase: '#5a3d2b', glass: '#bfe6ff', glassEdge: '#f2fbff', bench: '#7a5233', pool: '#3d7fb0', poolHi: '#6aa6d1',
    rim: '#d9d2c3', partition: '#4f5a53', lectern: '#6b4a2b', gold: '#d4a72c', goldDark: '#7a5a10', goldHi: '#fff2b0',
    door: '#6b4a2b', staffDoor: '#4a3320', exit: '#2f8f5b', placard: '#ffd23f', panel: '#efe6cc', mat: '#5f8f6b',
    player: '#2ec4b6', playerHead: '#f4e3c8', playerLine: '#0f302c',
    asleep: '#8394b8', asleepHead: '#c9d2e6', asleepLine: '#2b3248',
    stirring: '#e0a030', stirringHead: '#f6d48a', stirringLine: '#4a3208',
    awake: '#e04848', awakeHead: '#f7b0a8', awakeLine: '#4a0f0f',
    telegraph: '#e83a3a', tap: '#ffd23f', fog: 'rgba(8,8,16,0.55)', void: '#0d0c10',
  };
  UI.build = function (opts) {
    const css = `
      #ui-top,#ui-bot{position:absolute;left:0;right:0;background:#17151d;color:#e8e2d6;font:600 14px/1.2 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;z-index:5}
      #ui-top{top:0;height:${UI.TOP}px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;box-sizing:border-box;border-bottom:1px solid #2a2733}
      #ui-bot{bottom:0;height:${UI.BOTTOM}px;border-top:1px solid #2a2733}
      #ui-strip{height:60px;padding:6px 12px;box-sizing:border-box}
      #ui-strip .t{font-size:14px} #ui-strip .s{font-size:12px;color:#b8b0a2;margin-top:4px;font-weight:500}
      .pip{display:inline-block;width:8px;height:8px;border-radius:4px;border:1.5px solid #e0a030;margin-left:3px;vertical-align:middle}
      .pip.f{background:#e0a030}
      #ui-bar{height:52px;display:flex;gap:8px;padding:4px 12px 8px;box-sizing:border-box}
      #ui-bar div{flex:1;background:#24212c;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#cfc8ba}
      .lbl{position:absolute;z-index:4;font:700 13px/1 -apple-system,system-ui,sans-serif;color:#fff;background:rgba(20,18,26,.85);border:1.5px solid #fff;border-radius:9px;padding:2px 5px;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:none}
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const top = document.createElement('div'); top.id = 'ui-top';
    top.innerHTML = `<span>HP 20/20</span><span>${opts.title || ''}</span><span>19:41</span>`;
    const bot = document.createElement('div'); bot.id = 'ui-bot';
    bot.innerHTML = `<div id="ui-strip"><div class="t">Plaster Saint, stirring <span class="pip f"></span><span class="pip f"></span><span class="pip"></span></div>
      <div class="s">Wakes when it sees you. Lunges three tiles.</div></div>
      <div id="ui-bar"><div>Wait</div><div>Search</div><div>Bag</div><div>Slot 1</div><div>Slot 2</div></div>`;
    document.body.appendChild(top); document.body.appendChild(bot);
  };
  // Play area (CSS px) between the bars.
  UI.playRect = function () {
    const w = UI.VW, h = UI.VH;
    return { x: 0, y: UI.TOP, w, h: h - UI.TOP - UI.BOTTOM, cx: w / 2, cy: UI.TOP + (h - UI.TOP - UI.BOTTOM) / 2 };
  };
  root.UI = UI;
})(window);
