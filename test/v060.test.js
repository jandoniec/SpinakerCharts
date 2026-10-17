import test from 'node:test';
import assert from 'node:assert/strict';
import {lowerBoundTime,upperBoundTime,visibleTimeBounds} from '../src/studio.js';
import {windRoseBins,polarVMGCurve,sampleScatter} from '../src/sailing-advanced.js';
import {readFileSync} from 'node:fs';
const rows=Array.from({length:100000},(_,i)=>({timestamp:i*1000}));
test('binary time bounds work for large chronological telemetry',()=>{
  assert.equal(lowerBoundTime(rows,1001),2);assert.equal(upperBoundTime(rows,2000),3);
  assert.deepEqual(visibleTimeBounds(rows,1001,2000),[2,3]);
  assert.deepEqual(visibleTimeBounds(rows,2000,1000),[0,0]);
});
test('wind rose keeps sample counts and circular north boundary',()=>{
 const r=windRoseBins([{twd:359,tws:10},{twd:1,tws:14},{twd:90,tws:6},{twd:null,tws:5}],{sectors:8});
 assert.equal(r.reduce((s,b)=>s+b.count,0),3);assert.equal(r[0].count,2);
 assert.equal(r[0].avgSpeed,12);assert.equal(r[2].count,1);
});
test('VMG polar curve has signed VMG and no extrapolation',()=>{
 const polar=[{tws:12,twa:0,speed:5},{tws:12,twa:90,speed:7},{tws:12,twa:180,speed:6}];
 const curve=polarVMGCurve(polar,12,{step:90});
 assert.equal(curve[0].vmg,5);assert.ok(Math.abs(curve[1].vmg)<1e-12);assert.equal(curve[2].vmg,-6);
});
test('scatter sampling never exceeds point cap and preserves boundaries',()=>{
 const rows=Array.from({length:900000},(_,i)=>i);const out=sampleScatter(rows,900);
 assert.equal(out.length,900);assert.equal(out[0],0);assert.equal(out.at(-1),899999);
});
test('demo does not expose any chart appearance inputs',()=>{
 const html=readFileSync(new URL('../demo/studio.html',import.meta.url),'utf8');
 for(const token of ['Chart Appearance &amp; Time Range','id="bgColor"','id="lineWidth"','id="theme"','id="rangeFrom"']) assert.equal(html.includes(token),false,token);
});
test('replay icons cannot intercept button actions',()=>{
 const css=readFileSync(new URL('../src/replay.js',import.meta.url),'utf8');
 assert.match(css,/\.spk-replay-btn svg \*\{pointer-events:none\}/);
 assert.match(css,/closest\('button\[data-action\]'\)/);
});
