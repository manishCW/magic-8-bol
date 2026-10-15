import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineIssues,receivedPoMessage} from './issues.mjs';
test('received PO message requires exact PO match and every line received',()=>{
 const lines=[{po:'PO7689',ordered:14,received:14},{po:'PO7689',ordered:80,received:80}];
 assert.match(receivedPoMessage(lines,' po7689 '),/already fully received/);
 assert.equal(receivedPoMessage(lines,'768'), '');
 assert.equal(receivedPoMessage(lines,'PO123'), '');
 assert.equal(receivedPoMessage([...lines,{po:'PO7689',ordered:2,received:0,closed:true}],'PO7689'), '');
});
const row={item:'SKU1',site:'Denton',uom:'PC',date:'2026-09-27'};
test('missing match and overdue can both be inspected, without claiming missing tare',()=>{const issues=lineIssues(row,{spec:null,tare:null},'2026-09-28');assert.deepEqual(issues.map(i=>i.type),['spec','overdue']);assert.match(issues[0].detail,/SKU1.*Denton.*PC/);});
test('pallet weight is ignored while missing dates remain flagged',()=>{assert.deepEqual(lineIssues({...row,date:''},{spec:{},tare:null},'2026-09-28').map(i=>i.type),['date']);assert.deepEqual(lineIssues({...row,date:'2026-09-28'},{spec:{},tare:0},'2026-09-28'),[]);});
