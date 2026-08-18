/* POWER CITY - the cast, and the things they hit each other with.
 *
 * Palettes only: every fighter shares one rig, so a new gang member is nine
 * colours and a hairstyle. Weapons and throwables are baked here too, since
 * they are drawn by the same outline pass as the bodies and have to match.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var Art = PC.art, Rig = PC.rig;

  function pal(o) { return o; }

  // -------------------------------------------------------------- the heroes
  Rig.def('hero1', {
    name: 'BILLY', vest: true, hair: 'flat',
    pal: pal({
      skin: '#f4b183', skinD: '#c07a4e', hair: '#1b1b30', eye: '#141422',
      shirt: '#eef1f8', shirtD: '#b3b9cc',
      pants: '#2f52d8', pantsD: '#1c327f', trim: '#16224a',
      shoe: '#ffffff', shoeD: '#8f96ad', out: '#0a0a12'
    })
  });

  Rig.def('hero2', {
    name: 'JIMMY', vest: true, hair: 'flat',
    pal: pal({
      skin: '#f4b183', skinD: '#c07a4e', hair: '#3c2412', eye: '#141422',
      shirt: '#eef1f8', shirtD: '#b3b9cc',
      pants: '#d33a2c', pantsD: '#8c1f18', trim: '#4a1410',
      shoe: '#ffffff', shoeD: '#8f96ad', out: '#0a0a12'
    })
  });

  // --------------------------------------------------------------- the gang
  Rig.def('punk', {
    name: 'WILLIAMS', hair: 'flat',
    pal: pal({
      skin: '#e8a878', skinD: '#b0724a', hair: '#e2622a', eye: '#141422',
      shirt: '#23232e', shirtD: '#141420',
      pants: '#e2422a', pantsD: '#992414', trim: '#5c1a10',
      shoe: '#ffffff', shoeD: '#8f96ad', out: '#0a0a12'
    })
  });

  Rig.def('rough', {
    name: 'LINDA', hair: 'spiky',
    pal: pal({
      skin: '#e8a878', skinD: '#b0724a', hair: '#8c3ad8', eye: '#141422',
      shirt: '#23232e', shirtD: '#141420',
      pants: '#a63ad8', pantsD: '#65208c', trim: '#3d1252',
      shoe: '#ffffff', shoeD: '#8f96ad', out: '#0a0a12'
    })
  });

  Rig.def('knifer', {
    name: 'JEFF', hair: 'cap', sleeves: true,
    pal: pal({
      skin: '#c98a5c', skinD: '#96603a', hair: '#1e2a18', eye: '#141422',
      shirt: '#3f8c46', shirtD: '#26592c',
      pants: '#2c3a2a', pantsD: '#1a241a', trim: '#141c14',
      shoe: '#6b5a3a', shoeD: '#42371f', out: '#0a0a12'
    })
  });

  Rig.def('batter', {
    name: 'ROPER', hair: 'mohawk', sleeves: true,
    pal: pal({
      skin: '#e8a878', skinD: '#b0724a', hair: '#f0d63a', eye: '#141422',
      shirt: '#2f7fd8', shirtD: '#1d4d85',
      pants: '#38405c', pantsD: '#232840', trim: '#161a2c',
      shoe: '#c04030', shoeD: '#7a2620', out: '#0a0a12'
    })
  });

  Rig.def('brute', {
    name: 'ABORE', hair: 'bald', scale: 1.16, bulk: 1.3,
    pal: pal({
      skin: '#b8865a', skinD: '#845a36', hair: '#2b2b1e', eye: '#141422',
      shirt: '#4a5266', shirtD: '#2e3444',
      pants: '#7a5230', pantsD: '#4d331c', trim: '#2c1c0f',
      shoe: '#3c3c4a', shoeD: '#22222c', out: '#0a0a12'
    })
  });

  // ---------------------------------------------------------------- bosses
  Rig.def('boss_crusher', {
    name: 'CRUSHER', hair: 'bald', scale: 1.34, bulk: 1.38, boss: true,
    pal: pal({
      skin: '#c08a52', skinD: '#8a5c2e', hair: '#241a12', eye: '#2a0a0a',
      shirt: '#7a2a24', shirtD: '#4c1712',
      pants: '#2a2a38', pantsD: '#181822', trim: '#e0b040',
      shoe: '#1e1e28', shoeD: '#101018', out: '#0a0a12'
    })
  });

  Rig.def('boss_viper', {
    name: 'VIPER', hair: 'pony', scale: 1.06, bulk: 0.95, boss: true,
    pal: pal({
      skin: '#f0b48c', skinD: '#bc7c54', hair: '#20c4a8', eye: '#141422',
      shirt: '#1c1c28', shirtD: '#101018',
      pants: '#20a890', pantsD: '#136055', trim: '#0c3a33',
      shoe: '#f0f0f4', shoeD: '#9098a8', out: '#0a0a12'
    })
  });

  Rig.def('boss_jaws', {
    name: 'JAWS', hair: 'mohawk', scale: 1.2, bulk: 1.16, boss: true,
    pal: pal({
      skin: '#d09060', skinD: '#9a6238', hair: '#e0e0ec', eye: '#141422',
      shirt: '#8c1c2c', shirtD: '#571018', sleeves: true,
      pants: '#3a2a1c', pantsD: '#241a10', trim: '#c8a038',
      shoe: '#221c14', shoeD: '#141008', out: '#0a0a12'
    })
  });

  Rig.def('boss_power', {
    name: 'MR. POWER', hair: 'flat', scale: 1.14, bulk: 1.08, boss: true, sleeves: true,
    pal: pal({
      skin: '#e8b48c', skinD: '#b07a54', hair: '#101018', eye: '#3a0a0a',
      shirt: '#1a1a26', shirtD: '#0e0e16',
      pants: '#1a1a26', pantsD: '#0e0e16', trim: '#c0182c',
      shoe: '#0c0c12', shoeD: '#05050a', out: '#0a0a12'
    })
  });

  // ---------------------------------------------------------------- weapons
  /* Weapons hang off the fighter's front hand. Each is baked pointing right
   * with a grip point, so the same canvas serves held, swung and thrown. */
  var W = PC.weapons = {};

  function weapon(key, spec) { W[key] = spec; return spec; }

  function bakeBat() {
    var c = Art.mk(24, 8), x = c.getContext('2d');
    Art.limb(x, 3, 4, 21, 4, 2.5, 5.5, '#c08a44');
    Art.limb(x, 3, 4, 12, 4, 2.5, 3.4, '#8a5c2c');
    Art.rect(x, 2, 2, 2, 4, '#5c3a1c');
    Art.limb(x, 12, 3, 21, 3, 1, 2, '#e0b070');
    return Art.outline(c, '#0a0a12', 1);
  }

  function bakeKnife() {
    var c = Art.mk(16, 7), x = c.getContext('2d');
    Art.rect(x, 1, 3, 5, 3, '#3a3a4a');
    Art.rect(x, 5, 2, 2, 5, '#8a8a9c');
    Art.limb(x, 7, 3.5, 14, 3.5, 4, 1, '#d8dce8');
    Art.limb(x, 7, 3, 13, 3, 1.4, 1, '#f4f8ff');
    return Art.outline(c, '#0a0a12', 1);
  }

  function bakePipe() {
    var c = Art.mk(22, 6), x = c.getContext('2d');
    Art.limb(x, 2, 3, 20, 3, 3.6, 3.6, '#98a0b4');
    Art.limb(x, 2, 2, 20, 2, 1.2, 1.2, '#d8dce8');
    Art.rect(x, 17, 0, 4, 6, '#6c7488');
    return Art.outline(c, '#0a0a12', 1);
  }

  function bakeChain() {
    var c = Art.mk(26, 6), x = c.getContext('2d');
    for (var i = 0; i < 8; i++) Art.ellipse(x, 3 + i * 3, 3, 1.8, 1.6, i % 2 ? '#9aa2b6' : '#c8ceda');
    Art.ellipse(x, 22, 3, 3, 2.6, '#6c7488');
    return Art.outline(c, '#0a0a12', 1);
  }

  weapon('bat', { label: 'BAT', canvas: null, grip: [4, 4], dmg: 14, reach: 26, hits: 'sweep', ammo: 8, make: bakeBat });
  weapon('pipe', { label: 'PIPE', canvas: null, grip: [3, 3], dmg: 12, reach: 24, hits: 'sweep', ammo: 8, make: bakePipe });
  weapon('knife', { label: 'KNIFE', canvas: null, grip: [3, 4], dmg: 10, reach: 18, hits: 'stab', ammo: 6, throwable: true, make: bakeKnife });
  weapon('chain', { label: 'CHAIN', canvas: null, grip: [3, 3], dmg: 11, reach: 30, hits: 'sweep', ammo: 10, make: bakeChain });

  // ------------------------------------------------------------ throwables
  var P = PC.props = {};

  function bakeCrate() {
    var c = Art.mk(20, 18), x = c.getContext('2d');
    Art.rect(x, 0, 0, 20, 18, '#a8702c');
    Art.rect(x, 1, 1, 18, 16, '#c08a44');
    Art.rect(x, 1, 1, 18, 2, '#d8a664');
    Art.limb(x, 1, 17, 19, 1, 2, 2, '#8a5c2c');
    Art.limb(x, 1, 1, 19, 17, 2, 2, '#8a5c2c');
    Art.rect(x, 0, 0, 20, 2, '#8a5c2c');
    return Art.outline(c, '#0a0a12', 1);
  }

  function bakeDrum() {
    var c = Art.mk(16, 22), x = c.getContext('2d');
    Art.rect(x, 0, 2, 16, 18, '#b03428');
    Art.rect(x, 1, 2, 6, 18, '#d8503c');
    Art.rect(x, 12, 2, 3, 18, '#7a1e18');
    Art.ellipse(x, 8, 3, 8, 3, '#e06450');
    Art.rect(x, 0, 6, 16, 2, '#f0d8a0');
    Art.rect(x, 0, 14, 16, 2, '#f0d8a0');
    return Art.outline(c, '#0a0a12', 1);
  }

  P.crate = { hp: 2, dmg: 16, make: bakeCrate };
  P.drum = { hp: 3, dmg: 18, make: bakeDrum, explodes: true };

  // ---------------------------------------------------------------- pickups
  var I = PC.pickups = {};

  function bakeHeart() {
    var c = Art.mk(13, 12), x = c.getContext('2d');
    Art.ellipse(x, 4, 4, 4, 4, '#e03c50');
    Art.ellipse(x, 9, 4, 4, 4, '#e03c50');
    for (var i = 0; i < 8; i++) Art.rect(x, 1 + i * 0.75, 5 + i, 11 - i * 1.5, 1, '#e03c50');
    Art.rect(x, 3, 2, 2, 2, '#f88090');
    return Art.outline(c, '#0a0a12', 1);
  }

  function bakeCoin() {
    var c = Art.mk(12, 12), x = c.getContext('2d');
    Art.ellipse(x, 6, 6, 5.5, 5.5, '#c89018');
    Art.ellipse(x, 6, 6, 4, 4, '#f0d040');
    Art.rect(x, 5, 3, 2, 6, '#c89018');
    return Art.outline(c, '#0a0a12', 1);
  }

  I.heart = { heal: 30, score: 500, make: bakeHeart };
  I.coin = { heal: 0, score: 1000, make: bakeCoin };

  // Weapons, props and pickups all bake the same way; do it once at boot.
  PC.bakeThings = function () {
    var k;
    for (k in W) if (!W[k].canvas) W[k].canvas = W[k].make();
    for (k in P) if (!P[k].canvas) P[k].canvas = P[k].make();
    for (k in I) if (!I[k].canvas) I[k].canvas = I[k].make();
  };

})(typeof window !== 'undefined' ? window : globalThis);
