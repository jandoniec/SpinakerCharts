import test from 'node:test';
import assert from 'node:assert/strict';
import {chartTypes,chartThemes,createChart} from '../src/index.js';
test('exposes 20 chart types',()=>{assert.equal(chartTypes.length,20);assert.equal(new Set(chartTypes).size,20);});
test('ships 3 design themes',()=>{assert.deepEqual(Object.keys(chartThemes),['midnight','daylight','slate']);});
test('rejects rendering outside a browser',()=>{assert.throws(()=>createChart('#target',{type:'line',data:[]}),/browser DOM/);});
