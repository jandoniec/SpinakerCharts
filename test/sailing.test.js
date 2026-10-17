import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePolarData,computeVMG,findBestVMG,buildPerformanceMatrix,createSailingPolar} from '../src/sailing.js';
test('mirrors port-starboard and averages samples',()=>{const res=normalizePolarData([{tws:12,twa:-40,speed:7},{tws:12,twa:40,speed:9},{tws:14,twa:70,speed:10}]);assert.equal(res.length,2);assert.deepEqual(res[0].points,[{twa:40,speed:8,samples:2}]);});
test('maps 320 degrees to an absolute 40 degree TWA',()=>{const res=normalizePolarData([{tws:12,twa:320,speed:8}]);assert.equal(res[0].points[0].twa,40);});
test('VMG math and best VMG on beat/run',()=>{assert.ok(Math.abs(computeVMG(10,60)-5)<1e-10);const pts=[{twa:35,speed:6},{twa:50,speed:9},{twa:140,speed:8},{twa:165,speed:6}];assert.equal(findBestVMG(pts,'upwind').twa,50);assert.equal(findBestVMG(pts,'downwind').twa,140);});
test('missing heatmap cells are null and not zero',()=>{const matrix=buildPerformanceMatrix([{tws:8,twa:45,speed:5}],{windSteps:[8,12],angleSteps:[45,90]});assert.equal(matrix.length,4);assert.equal(matrix[3].value,null);assert.equal(matrix[3].samples,0);});
test('rejects browser chart rendering under Node',()=>assert.throws(()=>createSailingPolar(null,{data:[]}),/browser DOM/));
