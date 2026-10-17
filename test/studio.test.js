import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTelemetry,closestSampleIndex,createTelemetryController,interpolatePolar,polarPerformance,comparePolars,resolveStyle} from '../src/studio.js';

const reference=[8,12].flatMap(tws=>[{tws,twa:40,speed:tws/2},{tws,twa:60,speed:tws/2+2},{tws,twa:90,speed:tws/2+3}]);
test('oś czasu sortuje poprawnie i odnajduje najbliższą próbkę',()=>{
 const r=normalizeTelemetry([{timestamp:3000,sog:3},{timestamp:1000,sog:1},{timestamp:2000,sog:2}]);
 assert.deepEqual(r.map(x=>x.timestamp),[1000,2000,3000]);assert.equal(closestSampleIndex(r,2300),1);
 assert.equal(closestSampleIndex([],100),-1);
});
test('kontroler: seek, zakres, prędkość i subskrypcja',()=>{
 const c=createTelemetryController([{timestamp:1000,sog:1},{timestamp:2000,sog:2},{timestamp:3000,sog:3}]);let count=0;const un=c.subscribe(()=>count++);
 c.seek(2200);assert.equal(c.getState().index,1);c.setRange(1700,2700);c.seek(1000);
 assert.equal(c.getState().cursor,1700);c.setSpeed(3);assert.equal(c.getState().speed,3);
 un();c.seek(2000);assert.equal(count,5);c.destroy();
});
test('odtwarzanie przewija sesję i zatrzymuje się na końcu',()=>{
 let now=0,scheduled=[];
 const c=createTelemetryController([{timestamp:1000},{timestamp:3000}],{clock:()=>now,requestFrame:fn=>{scheduled.push(fn);return scheduled.length;},cancelFrame:()=>{}});
 c.play();now=500;scheduled.shift()(now);assert.equal(c.getState().cursor,1500);
 now=2500;scheduled.shift()(now);assert.equal(c.getState().cursor,3000);
 assert.equal(c.getState().playing,false);c.destroy();
});
test('interpolacja TWA / TWS bez ekstrapolacji',()=>{
 assert.equal(interpolatePolar(reference,10,50),6);
 assert.equal(interpolatePolar(reference,12,30),null);
 assert.equal(interpolatePolar(reference,20,50),null);
});
test('performance i procent względem target speed',()=>{
 const rows=polarPerformance([{tws:10,twa:50,stw:6.6},{tws:20,twa:50,stw:9}],reference);
 assert.ok(Math.abs(rows[0].performancePercent-110)<1e-10);
 assert.equal(rows[1].performancePercent,null);
 assert.equal(rows[0].targetSpeed,6);
});
test('wiele jachtów na wspólnej osi TWA',()=>{
 const res=comparePolars([{name:'Rio',data:reference},{name:'Other',data:reference.map(x=>({...x,speed:x.speed*.9}))}],{tws:12,angles:[40,50]});
 assert.equal(res.length,2);assert.equal(res[0].values[0].speed,6);assert.equal(res[0].values[1].speed,5.4);
});
test('motyw i nadpisania są odseparowane od oryginału',()=>{
 const custom=resolveStyle('midnight',{accent:'#123456',colors:['#abc']});custom.colors.push('z');
 assert.equal(resolveStyle('midnight').accent,'#58e0d0');assert.equal(resolveStyle('midnight').colors.length,6);
});
