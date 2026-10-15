import {test} from 'node:test';
import assert from 'node:assert/strict';
import {siteMatches,workloadGroups,attentionCsv} from './reporting.mjs';
const base={id:'1',po:'PO1',site:'A',item:'SKU',uom:'PC',ordered:10,received:2,date:'2026-09-30',vendor:'Vendor'};
const calc=r=>({quantity:r.ordered-r.received,pallets:r.item==='missing'?null:2,goods:r.item==='missing'?null:80,spec:r.item==='missing'?null:{}});
test('multiple sites and all-sites selection',()=>{assert.ok(siteMatches(base,[]));assert.ok(siteMatches(base,['A','B']));assert.equal(siteMatches(base,['B']),false);});
test('date groups count distinct POs and exclude received, closed, overdue and undated lines',()=>{const rows=[base,{...base,id:'2'},{...base,po:'PO2',item:'missing'},{...base,closed:true},{...base,received:10},{...base,date:''},{...base,date:'2026-09-29'}];assert.deepEqual(workloadGroups(rows,calc,'2026-09-30','expected'),[{key:'2026-09-30',pos:2,pallets:4,weight:160,missing:1,lines:3}]);});
test('past-due PO groups combine dates but only outstanding past-due lines',()=>{const rows=[{...base,date:'2026-09-28'},{...base,date:'2026-09-29'},base];assert.deepEqual(workloadGroups(rows,calc,'2026-09-30','past'),[{key:'PO1',pos:1,pallets:4,weight:160,missing:0,lines:2}]);});
test('export contains all issue rows, respects category and escapes CSV/formula values',()=>{const rows=[base,{...base,id:'2',item:'missing',vendor:'=danger,"x"'},{...base,id:'3',date:''}];const csv=attentionCsv(rows,calc,'2026-09-30',x=>x);assert.equal(csv.split('\r\n').length,3);assert.ok(csv.includes('"\'=danger,""x"""'));assert.equal(attentionCsv(rows,calc,'2026-09-30',x=>x,'date').split('\r\n').length,2);assert.ok(csv.includes('Missing SKU match'));});
