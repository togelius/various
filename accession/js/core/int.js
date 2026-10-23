// ACCESSION — integer helpers with stated rounding (BUILD.md §3.3).
'use strict';
const Int = (() => {
  const idiv = (a, b) => Math.floor(a / b);                 // floor division
  const ceilDiv = (a, b) => Math.ceil(a / b);
  const round10 = (num, den) => 10 * Math.floor((Math.floor(num / den) + 5) / 10);   // to the nearest 10, halves up
  const pct = (a, p) => Math.floor(a * p / 100);
  return { idiv, ceilDiv, round10, pct };
})();
