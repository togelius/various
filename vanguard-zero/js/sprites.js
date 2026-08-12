/* VANGUARD ZERO - hand-authored pixel art.
 *
 * The player is built from a torso (17px) and a swappable leg block (7px) so
 * the run cycle only costs leg frames, which is how sprites of this era were
 * usually assembled anyway. Gun arms are overlaid at per-pose anchors.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});
  var A = VZ.art;

  // ------------------------------------------------------------- palettes
  var PAL = {
    o: '#12142e', // outline
    d: '#22357a', // dark armour
    b: '#3a63c8', // mid armour
    l: '#6f9dfa', // light armour
    w: '#d6e8ff', // highlight
    c: '#5fe6d8', // visor / energy
    y: '#ffd24a', // gold trim
    r: '#ff5a6e', // core
    g: '#a8b4d0', // metal light
    k: '#5a6480', // metal dark
    s: '#f2c39a'  // skin
  };

  // Enemy palette (reds/greys), shared by most grunts.
  var EPAL = {
    o: '#170f18',
    d: '#5c2230',
    b: '#963444',
    l: '#d05a58',
    w: '#ffb0a0',
    c: '#ffd24a',
    e: '#ff3d3d', // eye
    g: '#8f97ac',
    k: '#454c60',
    y: '#ffe08a',
    v: '#5fe6d8'
  };

  var SPR = VZ.sprites = { pal: PAL, epal: EPAL };

  // ================================================================= PLAYER
  // Torso: 16 wide x 17 tall. Bottom row meets the leg block.
  var TORSO_IDLE = [
    '....oooooo......',
    '...odddddddo....',
    '..odbbbbbbbdo...',
    '..obwwbbbbbbdo..',
    '..obwbbcccccco..',
    '..obbbbcccccco..',
    '..odbbbcccccco..',
    '....odbbbbbdo...',
    '.oyyybbbbbbyyyo.',
    '..oyybbbbbbyyo..',
    '..obdbllllbdbo..',
    '..obdlwwwwlbdo..',
    '..obdlwwwwlbdo..',
    '..obdbrrrrbbdo..',
    '..obddbbbbddbo..',
    '...obdbbbbdbo...',
    '....obbbbbbo....'
  ];

  // Leaning forward: head pushed 1px right, shoulders dropped.
  var TORSO_RUN = [
    '.....oooooo.....',
    '....odddddddo...',
    '...odbbbbbbbdo..',
    '...obwwbbbbbbdo.',
    '...obwbbcccccco.',
    '...obbbbcccccco.',
    '...odbbbcccccco.',
    '.....odbbbbbdo..',
    '.oyyybbbbbbyyyo.',
    '..oyybbbbbbyyo..',
    '..obdbllllbdbo..',
    '..obdlwwwwlbdo..',
    '..obdlwwwwlbdo..',
    '..obdbrrrrbbdo..',
    '..obddbbbbddbo..',
    '...obdbbbbdbo...',
    '....obbbbbbo....'
  ];

  // Deep forward lean for the dash.
  var TORSO_DASH = [
    '................',
    '......oooooo....',
    '.....odddddddo..',
    '....odbbbbbbbdo.',
    '....obwbbcccccco',
    '....obbbbcccccco',
    '....odbbbcccccco',
    '......odbbbbbdo.',
    '.oyyybbbbbbyyyo.',
    '..oyybbbbbbyyo..',
    '..obdbllllbdbo..',
    '..obdlwwwwlbdo..',
    '..obdbrrrrbbdo..',
    '..obddbbbbddbo..',
    '...obdbbbbdbo...',
    '....obbbbbbo....',
    '................'
  ];

  // Arms tucked, body upright, looking up slightly (airborne).
  var TORSO_AIR = [
    '....oooooo......',
    '...odddddddo....',
    '..odbbbbbbbdo...',
    '..obwwbbbbbbdo..',
    '..obwbbcccccco..',
    '..obbbbcccccco..',
    '..odbbbcccccco..',
    '....odbbbbbdo...',
    '.oyyybbbbbbyyyo.',
    '..oyybbbbbbyyo..',
    '..obdbllllbdbo..',
    '..obdlwwwwlbdo..',
    '..obdlwwwwlbdo..',
    '..obdbrrrrbbdo..',
    '..obddbbbbddbo..',
    '...obdbbbbdbo...',
    '....obbbbbbo....'
  ];

  // Pressed against a wall on the right side of the sprite.
  var TORSO_WALL = [
    '...oooooo.......',
    '..odddddddo.....',
    '.odbbbbbbbdo....',
    '.obwwbbbbbbdo...',
    '.obwbbcccccco...',
    '.obbbbcccccco...',
    '.odbbbcccccco...',
    '...odbbbbbdo....',
    'oyyybbbbbbyyyoko',
    '.oyybbbbbbyyo.ko',
    '.obdbllllbdbo.o.',
    '.obdlwwwwlbdo...',
    '.obdlwwwwlbdo...',
    '.obdbrrrrbbdo...',
    '.obddbbbbddbo...',
    '..obdbbbbdbo....',
    '...obbbbbbo.....'
  ];

  // Knocked back.
  var TORSO_HURT = [
    '......oooooo....',
    '.....odddddddo..',
    '....odbbbbbbbdo.',
    '....obwwbbbbbbdo',
    '....obwbbcccccco',
    '....obbbbcccccco',
    '....odbbbcccccco',
    '......odbbbbbdo.',
    '.oyyybbbbbbyyyo.',
    '..oyybbbbbbyyo..',
    '..obdbllllbdbo..',
    '..obdlwwwwlbdo..',
    '..obdbrrrrbbdo..',
    '..obddbbbbddbo..',
    '...obdbbbbdbo...',
    '....obbbbbbo....',
    '................'
  ];

  // -------- leg blocks: 16 wide x 7 tall, ground contact on the last row ---
  var LEGS = {
    idle: [
      '....obbboobbbo..',
      '....obbo..obbo..',
      '....obbo..obbo..',
      '....obbo..obbo..',
      '...obggo..obggo.',
      '...ogggo..ogggo.',
      '...ooooo..ooooo.'
    ],
    // 6-frame run cycle
    run0: [
      '....obboobbo....',
      '...obbo..obbo...',
      '..obbo....obbo..',
      '..obo......obo..',
      '.oggo......oggo.',
      '.ogggo....ogggo.',
      '.ooooo....ooooo.'
    ],
    run1: [
      '....obboobbo....',
      '...obbo..obbo...',
      '...obbo...obbo..',
      '...obbo...obbo..',
      '..oggo....oggo..',
      '..ogggo..ogggo..',
      '..ooooo..ooooo..'
    ],
    run2: [
      '....obboobbo....',
      '....obbo.obbo...',
      '...obbbo..obbo..',
      '...oggo....obbo.',
      '...oooo....oggo.',
      '...........ogggo',
      '...........ooooo'
    ],
    run3: [
      '....obboobbo....',
      '...obbo..obbo...',
      '..obbo....obbo..',
      '..obo......obo..',
      '.oggo......oggo.',
      '.ogggo....ogggo.',
      '.ooooo....ooooo.'
    ],
    run4: [
      '....obboobbo....',
      '...obbo..obbo...',
      '..obbo....obbo..',
      '..obbo....obbo..',
      '..oggo....oggo..',
      '..ogggo..ogggo..',
      '..ooooo..ooooo..'
    ],
    run5: [
      '....obboobbo....',
      '...obbo..obbo...',
      '..obbo...obbbo..',
      '.obbo.....oggo..',
      '.obbo.....oooo..',
      '.oggo...........',
      '.ogggo..........'
    ],
    jump: [
      '....obboobbo....',
      '...obbo...obbo..',
      '..obbo.....obbo.',
      '..oggo.....obbo.',
      '..ogggo....oggo.',
      '..ooooo...ogggo.',
      '..........ooooo.'
    ],
    fall: [
      '....obboobbo....',
      '...obbo...obbo..',
      '...obbo....obbo.',
      '..obbo......obo.',
      '..oggo.....oggo.',
      '.ogggo....ogggo.',
      '.ooooo....ooooo.'
    ],
    dash: [
      '..obboobbo......',
      '.obbo..obbbo....',
      'obbo.....obbbo..',
      'oggo.......obbbo',
      'ogggo.......oggo',
      'ooooo......ogggo',
      '...........ooooo'
    ],
    wall: [
      '...obboobbo.....',
      '..obbo...obbo...',
      '..obbo....obbo..',
      '..obbo.....obbo.',
      '..oggo.....oggo.',
      '..ogggo...ogggo.',
      '..ooooo...ooooo.'
    ],
    hurt: [
      '....obboobbo....',
      '...obbo...obbo..',
      '..obbo.....obbo.',
      '.obbo.......obo.',
      '.oggo.......ogo.',
      'ogggo.......ogo.',
      'ooooo.......ooo.'
    ],
    kneel: [
      '....obboobbo....',
      '...obbo..obbo...',
      '..obbo...obbo...',
      '..obbo..obbo....',
      '..oggo.oggo.....',
      '..ogggogggo.....',
      '..oooooooo......'
    ]
  };

  // The buster arm, extended forward. Drawn over the torso when firing.
  var BUSTER = [
    '..ooooo.....',
    '.obbbboooooo',
    'obllllkggggo',
    'obllllkgccgo',
    '.obbbbkggggo',
    '..ooooooooo.'
  ];
  var BUSTER_CHARGE = [
    '..ooooo.....',
    '.obbbboooooo',
    'obllllkggggo',
    'obllllkgccgo',
    '.obbbbkggggo',
    '..ooooooooo.'
  ];

  // ================================================================ ENEMIES
  // Trooper: two-legged gun drone. 16x16.
  var TROOPER = {
    a: [
      '....oooooo......',
      '...obbbbbbo.....',
      '..obllllllbo....',
      '..obweeeewbo....',
      '..obllllllbo....',
      '..odbbbbbbdo....',
      '...obdddbo......',
      '..obbbbbbbboo...',
      '..obdlllldbggo..',
      '..obdlwwldbggoo.',
      '..obddddddboggko',
      '...obbooobbooko.',
      '...obo...obo....',
      '..obbo...obbo...',
      '..oggo...oggo...',
      '..oooo...oooo...'
    ],
    b: [
      '....oooooo......',
      '...obbbbbbo.....',
      '..obllllllbo....',
      '..obweeeewbo....',
      '..obllllllbo....',
      '..odbbbbbbdo....',
      '...obdddbo......',
      '..obbbbbbbboo...',
      '..obdlllldbggo..',
      '..obdlwwldbggoo.',
      '..obddddddboggko',
      '...obbooobbooko.',
      '...obo.....obo..',
      '..obbo.....obbo.',
      '..oggo.....oggo.',
      '..oooo.....oooo.'
    ]
  };

  // Drone: hovering eye with thrusters. 16x12.
  var DRONE = {
    a: [
      '.....oooo.......',
      '...ookkkkoo.....',
      '..oggggggggo....',
      '.ogglllllllgo...',
      '.oglweeeewlgo...',
      '.oglweeeewlgo...',
      '.ogglllllllgo...',
      '..oggggggggo....',
      '...okkkkkko.....',
      '....o.vv.o......',
      '......vv........',
      '.......v........'
    ],
    b: [
      '.....oooo.......',
      '...ookkkkoo.....',
      '..oggggggggo....',
      '.ogglllllllgo...',
      '.oglweeeewlgo...',
      '.oglweeeewlgo...',
      '.ogglllllllgo...',
      '..oggggggggo....',
      '...okkkkkko.....',
      '....o.vv.o......',
      '.......v........',
      '................'
    ]
  };

  // Hopper: crouching leaper. 16x14.
  var HOPPER = {
    crouch: [
      '................',
      '................',
      '.....oooooo.....',
      '...oobbbbbboo...',
      '..obllllllllbo..',
      '..oblweeeewlbo..',
      '.obdllllllllbdo.',
      '.obddddddddddbo.',
      '.obbdddddddddbo.',
      '..oobbbbbbbboo..',
      '.ogo........ogo.',
      '.ogo........ogo.',
      'ogggo......ogggo',
      'ooooo......ooooo'
    ],
    leap: [
      '.....oooooo.....',
      '...oobbbbbboo...',
      '..obllllllllbo..',
      '..oblweeeewlbo..',
      '.obdllllllllbdo.',
      '.obddddddddddbo.',
      '.obbdddddddddbo.',
      '..oobbbbbbbboo..',
      '.ogo........ogo.',
      'ogo..........ogo',
      'ogo..........ogo',
      'oggo........oggo',
      'ooo..........ooo',
      '................'
    ]
  };

  // Shielder: advances behind a plate; only vulnerable from behind/above. 16x18.
  var SHIELDER = {
    a: [
      '......oooooo....',
      '.....obbbbbbo...',
      '....obllllllbo..',
      '....obweeeewbo..',
      'oooo.obllllllbo.',
      'ogglo.odbbbbdo..',
      'ogglo.obbbbbbo..',
      'ogglobdllllldo..',
      'ogglgbdlwwwldo..',
      'ogglobdlllllbo..',
      'ogglo.obddddddo.',
      'ogglo..obbbbbo..',
      'ogglo..oboobo...',
      'oooo...obo.obo..',
      '.......obo.obo..',
      '......obgo.obgo.',
      '......oggo.oggo.',
      '......oooo.oooo.'
    ],
    b: [
      '......oooooo....',
      '.....obbbbbbo...',
      '....obllllllbo..',
      '....obweeeewbo..',
      'oooo.obllllllbo.',
      'ogglo.odbbbbdo..',
      'ogglo.obbbbbbo..',
      'ogglobdllllldo..',
      'ogglgbdlwwwldo..',
      'ogglobdlllllbo..',
      'ogglo.obddddddo.',
      'ogglo..obbbbbo..',
      'ogglo..oboobo...',
      'oooo..obo...obo.',
      '......obo...obo.',
      '.....obgo...obgo',
      '.....oggo...oggo',
      '.....oooo...oooo'
    ]
  };

  // Turret base (barrel is drawn procedurally so it can aim). 16x12.
  var TURRET = [
    '................',
    '....oooooooo....',
    '..ookkkkkkkkoo..',
    '.okggggggggggko.',
    'okggllllllllggko',
    'okgllweeeewllgko',
    'okgllweeeewllgko',
    'okggllllllllggko',
    '.okgggggggggko..',
    '..ookkkkkkkkoo..',
    '....oooooooo....',
    '................'
  ];

  // ================================================================ PICKUPS
  var PICK_HEALTH = [
    '..oooooo..',
    '.orrrrrro.',
    'orwwrrrrro',
    'orwrrrrrro',
    'orrrryrrro',
    'orrryyyrro',
    'orrrryrrro',
    'orrrrrrrro',
    '.orrrrrro.',
    '..oooooo..'
  ];
  var PICK_ENERGY = [
    '..oooooo..',
    '.occcccco.',
    'occwwcccco',
    'occwccccco',
    'occcyyccco',
    'occcyyccco',
    'occcyyccco',
    'occcccccco',
    '.occcccco.',
    '..oooooo..'
  ];
  var PICK_LIFE = [
    '..oooooo..',
    '.oyyyyyyo.',
    'oywwyyyyyo',
    'oywyybyyyo',
    'oyybllbyyo',
    'oyyblcbyyo',
    'oyybllbyyo',
    'oyyybyyyyo',
    '.oyyyyyyo.',
    '..oooooo..'
  ];

  // ============================================================== BUILD ALL
  SPR.build = function () {
    var g = A.gfx;

    function pair(name, rows, pal) {
      var r = A.sprite(rows, pal);
      g[name] = r;
      g[name + '_L'] = A.flipH(r);
      g[name + '_W'] = A.solid(r, '#ffffff');
      g[name + '_WL'] = A.flipH(g[name + '_W']);
      return r;
    }

    // player torsos + legs
    pair('torso_idle', TORSO_IDLE, PAL);
    pair('torso_run', TORSO_RUN, PAL);
    pair('torso_dash', TORSO_DASH, PAL);
    pair('torso_air', TORSO_AIR, PAL);
    pair('torso_wall', TORSO_WALL, PAL);
    pair('torso_hurt', TORSO_HURT, PAL);
    for (var lk in LEGS) pair('legs_' + lk, LEGS[lk], PAL);

    pair('buster', BUSTER, PAL);
    pair('buster_c', BUSTER_CHARGE, PAL);

    // enemies
    pair('trooper_a', TROOPER.a, EPAL);
    pair('trooper_b', TROOPER.b, EPAL);
    pair('drone_a', DRONE.a, EPAL);
    pair('drone_b', DRONE.b, EPAL);
    pair('hopper_c', HOPPER.crouch, EPAL);
    pair('hopper_l', HOPPER.leap, EPAL);
    pair('shielder_a', SHIELDER.a, EPAL);
    pair('shielder_b', SHIELDER.b, EPAL);
    pair('turret', TURRET, EPAL);

    // pickups
    pair('pick_health', PICK_HEALTH, PAL);
    pair('pick_energy', PICK_ENERGY, PAL);
    pair('pick_life', PICK_LIFE, PAL);

    // A palette-swapped rival built from the player's own frames.
    function rival(src) {
      return A.remap(src, function (r, gg, b) {
        // Swap the blue armour ramp to crimson, cyan visor to acid green.
        if (b > r && b > gg) return [Math.min(255, b), Math.round(gg * 0.45), Math.round(r * 0.85)];
        if (gg > 150 && b > 150 && r < 140) return [Math.round(b * 0.7), 255, Math.round(r * 0.6)];
        return [r, gg, b];
      });
    }
    ['torso_idle', 'torso_run', 'torso_dash', 'torso_air', 'torso_wall', 'torso_hurt',
     'legs_idle', 'legs_run0', 'legs_run1', 'legs_run2', 'legs_run3', 'legs_run4',
     'legs_run5', 'legs_jump', 'legs_fall', 'legs_dash', 'legs_wall', 'legs_kneel',
     'buster'].forEach(function (k) {
      var r = rival(g[k]);
      g['rv_' + k] = r;
      g['rv_' + k + '_L'] = A.flipH(r);
      g['rv_' + k + '_W'] = A.solid(r, '#ffffff');
      g['rv_' + k + '_WL'] = A.flipH(g['rv_' + k + '_W']);
    });
  };

  // Arm anchor per torso pose: where the buster sprite's left edge sits,
  // measured from the torso's left edge, facing right.
  SPR.ARM = {
    torso_idle: { x: 9, y: 10 },
    torso_run: { x: 9, y: 10 },
    torso_dash: { x: 9, y: 9 },
    torso_air: { x: 9, y: 10 },
    torso_wall: { x: 8, y: 10 },
    torso_hurt: { x: 9, y: 10 }
  };

})(typeof window !== 'undefined' ? window : globalThis);
