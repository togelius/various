// Hair must cover the back (-z), while beards sit on the face (+z).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = vm.createContext({ TEX: { names: {} } });
for (const file of ['math.js', 'meshes.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), ctx);
const mesh = vm.runInContext('MESH', ctx);
const look = { skin: [.9,.7,.5], shirt: [.8,.8,.7], pants: [.2,.2,.3], hair: [.11,.07,.03], sleeves: true };
function vertices(b, predicate) {
  const out = [];
  for (let i = 0; i < b.v.length; i += 13) { const v = b.v.slice(i, i + 13); if (predicate(v)) out.push(v); }
  return out;
}
let count = 0;
for (const lod of [false, true]) {
  for (const style of [0, 2, 7]) {
    const b = mesh.pedMesh({ ...look, hairStyle: style }, lod);
    const hair = vertices(b, v => v[12] === 1 && v.slice(6,9).every((c,i) => c === look.hair[i]) && v[1] < .145);
    assert(hair.length > 0);
    if (style !== 7) assert(hair.every(v => v[2] < 0), 'short and long rear hair must stay behind the face');
    count++;
  }
  for (const jacket of [null, [.3,.2,.1]]) for (const sleeves of [false,true]) {
    const b = mesh.pedMesh({...look, jacket, sleeves}, lod);
    assert(b.v.every(Number.isFinite));
    assert(b.i.every(i => Number.isInteger(i) && i >= 0 && i < b.n));
    assert(vertices(b, v => v[12] === 9).length && vertices(b, v => v[12] === 10).length, 'forearms retained for animation');
    count++;
  }
}
const beard = mesh.pedMesh({...look, hairStyle: 5, beard: true});
const beardVerts = vertices(beard, v => v[12] === 1 && v.slice(6,9).every((c,i) => c === look.hair[i]) && v[1] < .12);
assert(beardVerts.length && beardVerts.every(v => v[2] > 0), 'beard must cover the chin, not the side of the head');
console.log(`${count + 1} character geometry cases passed`);
