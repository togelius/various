// ACCESSION — the Bag (BUILD.md §7.2): your kit and tote, the quickslots, aiming a throw or
// an instrument, and the floor plan. [stub → W2b-UI-BAG]: the interface is named here with
// nothing behind it, and main.js does not attach it yet.
//   Bag.attach(app, handlers)   build its DOM inside app; handlers are main.js's callbacks
//   Bag.render(vm, labels)      show the view model's kit, tote and charges
//   Bag.open(), Bag.close()     the Bag panel
//   Bag.quick(n)                use quickslot n
//   Bag.map()                   the floor plan, once read
//   Bag.aiming() → null         the item being aimed, if any
//   Bag.tapAim(t) → null        a tap on tile t while aiming: the action it makes, if any
'use strict';
const Bag = {
  attach(app, handlers) {},
  render(vm, labels) {},
  open() {},
  close() {},
  quick(n) {},
  map() {},
  aiming() { return null; },
  tapAim(t) { return null; },
};
