import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelemetryController} from '../src/studio.js';
import {makeDashboardSVG} from '../src/composite.js';
function harness(){let now=0,seq=0;const jobs=new Map();return {clock:()=>now,requestFrame:fn=>{const id=++seq;jobs.set(id,fn);return id;},cancelFrame:id=>jobs.delete(id),advance(delta){now+=delta;const batch=[...jobs.values()];jobs.clear();batch.forEach(fn=>fn(now));},pending:()=>jobs.size};}
test('STOP podczas odtwarzania anuluje klatkę i zeruje kursor',()=>{
 const h=harness(),c=createTelemetryController([{timestamp:1000},{timestamp:4000},{timestamp:9000}],{...h,speed:2});
 c.play();h.advance(1000);assert.equal(c.getState().cursor,3000);c.stop();
 assert.equal(c.getState().cursor,1000);assert.equal(c.getState().playing,false);assert.equal(h.pending(),0);
 h.advance(1000);assert.equal(c.getState().cursor,1000);c.destroy();
});
test('PAUSE zachowuje kursor, STOP cofa także z pauzy, PLAY wznowi poprawnie',()=>{
 const h=harness(),c=createTelemetryController([{timestamp:1000},{timestamp:5000}],{...h});
 c.play();h.advance(1200);c.pause();assert.equal(c.getState().cursor,2200);
 c.stop();assert.equal(c.getState().cursor,1000);c.play();h.advance(700);
 assert.equal(c.getState().cursor,1700);c.destroy();
});
test('STOP jest idempotentne i nie resetuje zsynchronizowanego zoomu',()=>{
 const c=createTelemetryController([{timestamp:1000},{timestamp:7000}]);c.setViewRange(2000,5000);c.seek(4000);c.stop();c.stop();
 assert.equal(c.getState().cursor,1000);assert.deepEqual(c.getViewRange(),[2000,5000]);c.destroy();
});
test('STOP respektuje początek zmienionego zakresu replay',()=>{
 const c=createTelemetryController([{timestamp:1000},{timestamp:7000}]);c.setRange(2500,6000);c.seek(5000);c.stop();assert.equal(c.getState().cursor,2500);c.destroy();
});
test('Kompozycja SVG zawiera wykresy i poprawnie koduje tytuł',()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect width="10" height="10"/></svg>';
 const out=makeDashboardSVG([{toSVG:()=>svg},{toSVG:()=>svg}],{title:'Boat & Wind',columns:2});
 assert.match(out,/Boat &amp; Wind/);assert.equal((out.match(/<rect width="10"/g)||[]).length,2);
 assert.throws(()=>makeDashboardSVG([]),TypeError);
 assert.throws(()=>makeDashboardSVG([{toSVG:()=>svg}],{columns:0}),RangeError);
});
