import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelemetryController} from '../src/studio.js';
import {validateThemePreset,saveThemePreset,loadThemePreset} from '../src/themes.js';
import {serializeSVG,svgToPNG} from '../src/export.js';
import {createReplayBar} from '../src/replay.js';

test('synchronized zoom updates multiple subscribed chart consumers',()=>{
 const ctrl=createTelemetryController([{timestamp:1000},{timestamp:2000},{timestamp:3000},{timestamp:4000}]);
 let a,b;
 const ua=ctrl.subscribeView(range=>a=range),ub=ctrl.subscribeView(range=>b=range);
 ctrl.setViewRange(1500,3000);
 assert.deepEqual(a,[1500,3000]);assert.deepEqual(b,[1500,3000]);
 assert.deepEqual(ctrl.getViewRange(),[1500,3000]);
 ctrl.resetViewRange();assert.deepEqual(a,[1000,4000]);
 ua();ub();ctrl.destroy();
});
test('zoom respects session boundaries and prevents zero-width selection',()=>{
 const ctrl=createTelemetryController([{timestamp:1000},{timestamp:6000}]);
 ctrl.setViewRange(-100,1900);assert.deepEqual(ctrl.getViewRange(),[1000,3000]);
 ctrl.setViewRange(5000,8000);assert.deepEqual(ctrl.getViewRange(),[3000,6000]);
 assert.throws(()=>ctrl.setViewRange(3000,3000),RangeError);ctrl.destroy();
});
test('theme persistence roundtrip with injected storage and validation',()=>{
 const map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)??null};
 saveThemePreset('test',{theme:'midnight',accent:'#58e0d0',colors:['#ffffff']},storage);
 assert.deepEqual(loadThemePreset('test',storage),{theme:'midnight',accent:'#58e0d0',colors:['#ffffff']});
 assert.equal(loadThemePreset('missing',storage),null);
 assert.throws(()=>validateThemePreset({theme:'midnight',accent:'bad'}),TypeError);
});
test('image exporter checks empty svg and invalid environment',async()=>{
 assert.throws(()=>serializeSVG(null));
 await assert.rejects(svgToPNG(null),/Brak elementu SVG/);
 assert.equal(typeof createReplayBar,'function');
});
