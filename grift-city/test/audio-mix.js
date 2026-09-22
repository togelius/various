'use strict';
// Inert WebAudio graph: verify routing and mute without producing any sound.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=[],timers=[];
const param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
function node(kind){const n={kind,links:[],connect(to){this.links.push(to);},disconnect(){this.links=[];},start(){},stop(){},getFloatTimeDomainData(d){d.fill(0);}};for(const p of ['gain','frequency','detune','Q','pan','threshold','knee','ratio','attack','release','playbackRate'])n[p]=param();nodes.push(n);return n;}
class SilentContext{constructor(){this.currentTime=0;this.sampleRate=100;this.destination={kind:'speaker'};this.state='running';}createBuffer(ch,n){return {getChannelData:()=>new Float32Array(n)};}resume(){}}
for(const kind of ['Gain','DynamicsCompressor','Analyser','BiquadFilter','Convolver','Oscillator','BufferSource','WaveShaper','StereoPanner'])SilentContext.prototype['create'+kind]=()=>node(kind);
const c=vm.createContext({console,URLSearchParams,location:{search:'?mute=1'},localStorage:{getItem:()=>null,setItem(){}},window:{AudioContext:SilentContext},setTimeout:(f,t)=>timers.push({f,t}),PLAYER:{P:{y:0,camYaw:0}},W:{sight3:()=>false}});
vm.runInContext(fs.readFileSync(__dirname+'/../js/math.js','utf8'),c);vm.runInContext(fs.readFileSync(__dirname+'/../js/audio.js','utf8'),c);const a=vm.runInContext('AUDIO',c);
a.setMix({masterVolume:.35,vehicleVolume:.2,ambientVolume:.15,musicVolume:.1,quietMix:true});assert.equal(a.ensure(),true);const master=nodes.find(n=>n.links.some(p=>p.kind==='speaker')),compressor=nodes.find(n=>n.kind==='DynamicsCompressor');assert.equal(master.gain.value,0,'mute survives initialization');assert.equal(compressor.threshold.value,-27,'saved quiet mix applied at initialization');
a.setMix({masterVolume:.8});assert.equal(master.gain.value,0,'volume changes cannot unmute');const count=nodes.length;a.play('pistol',10,0);assert.equal(nodes.length,count,'muted shots allocate no voices');
a.toggleMute();assert.equal(master.gain.value,.8);a.play('pistol',10,0);const pan=nodes.find(n=>n.kind==='StereoPanner');assert.ok(pan.pan.value<0,'off-axis sound pans');const filter=nodes.find(n=>n.links.includes(pan));assert.equal(filter.frequency.value,1300,'occluded source is filtered');
a.play('gull',0,10);const gullPan=nodes.filter(n=>n.kind==='StereoPanner').at(-1);assert.equal(gullPan.links[0].gain.value,.15,'gull follows ambience volume');
a.play('horn',0,10);assert.equal(nodes.filter(n=>n.kind==='StereoPanner').at(-1).links[0].gain.value,.2,'horn follows vehicle volume');
a.toggleMute();a.setMix({quietMix:false});assert.equal(master.gain.value,0);assert.equal(compressor.ratio.value,4);assert.equal(a.peak(),0);
console.log('Audio graph: mute, saved mix, independent buses, quiet dynamics, occlusion and panning passed (no audio output)');
