import test from 'node:test';
import assert from 'node:assert/strict';
import {toUTCMilliseconds,formatChartTime,closestUTCIndex} from '../src/time.js';
import {normalizeTelemetry,createTelemetryController,toTimestamp} from '../src/studio.js';
test('UTC: te same chwile w różnych offsetach',()=>{
 const a=toUTCMilliseconds('2026-10-16T13:30:00Z');
 assert.equal(a,toUTCMilliseconds('2026-10-16T15:30:00+02:00'));
 assert.equal(toTimestamp(new Date(a)),a);
});
test('UTC: odrzucamy niejednoznaczny lokalny ISO i invalid',()=>{
 assert.throws(()=>toUTCMilliseconds('2026-10-16T13:30:00'),TypeError);
 assert.throws(()=>toUTCMilliseconds('2026-10-16'),TypeError);
 assert.throws(()=>toUTCMilliseconds(NaN),RangeError);
 assert.throws(()=>toUTCMilliseconds(1.5),RangeError);
});
test('UTC: przejście przez północ i format elapsed ponad dobę',()=>{
 const a=toUTCMilliseconds('2026-10-16T23:59:59Z');
 assert.equal(formatChartTime(a,{mode:'utc',seconds:true}),'23:59:59');
 assert.equal(formatChartTime(a+2000,{mode:'utc',seconds:true}),'00:00:01');
 assert.equal(formatChartTime(a+27*3600000+2300,{mode:'elapsed',origin:a,milliseconds:true}),'27:00:02.300');
});
test('UTC: format lokalny w jawnej strefie IANA',()=>{
 const a=toUTCMilliseconds('2026-10-16T13:30:00Z');
 assert.equal(formatChartTime(a,{mode:'local',timeZone:'Europe/Warsaw'}),'15:30:00');
});
test('UTC: wspólny kontroler i nearest z dozwoloną przerwą',()=>{
 const rows=normalizeTelemetry([{timestamp:'2026-10-16T14:00:01+02:00'},{timestamp:'2026-10-16T12:00:00Z'}]);
 assert.equal(rows[1].timestamp-rows[0].timestamp,1000);
 assert.equal(closestUTCIndex(rows,rows[0].timestamp+300,{maxGap:400}),0);
 assert.equal(closestUTCIndex(rows,rows[0].timestamp+500,{maxGap:100}),-1);
 const controller=createTelemetryController(rows);
 controller.seek('2026-10-16T12:00:01Z');
 assert.equal(controller.getState().index,1);
 controller.destroy();
});
