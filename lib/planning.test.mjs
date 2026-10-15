import {test} from 'node:test';import assert from 'node:assert/strict';import {lines,eligible,calculate,totals} from './planning.mjs';
test('partial receipt uses only outstanding units and excludes pallet weight',()=>{assert.deepEqual(calculate(lines[0]),{quantity:80,pallets:4,goods:2000,gross:2000});});
test('closed and fully received lines are excluded',()=>{assert.equal(eligible(lines).length,10);});
test('missing specifications remain unknown',()=>{assert.equal(calculate(lines[5]).gross,null);});
test('PO counts are distinct across multiple dates',()=>{assert.equal(totals(eligible(lines)).pos,9);assert.equal(totals(eligible(lines)).missing,1);});
