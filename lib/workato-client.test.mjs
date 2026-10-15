import test from 'node:test';
import assert from 'node:assert/strict';
import {allPages,getPage,normalizeItems,validateEndpoint} from './workato-client.mjs';
const config={url:'https://apim.workato.com/coreweave/magic-bol-v1/magic-bol',token:'test'};
const item={order_type:'PurchOrd',order_internal_id:'1',order_number:'PO1',line_id:'1',item_name:'A',line_location_name:'Denton',unit_of_measure:'EA',planning_receipt_date:'2026-10-14',line_closed:'F',raw_quantity:'25',raw_shipped_received_quantity:'5'};
test('pull fetches all pages with offset and detects repeated pages',async()=>{
 let calls=0;const got=await allPages(config,async(u,o)=>{assert.equal(o.headers['api-token'],'test');assert.equal(o.redirect,'error');assert.equal(u.searchParams.get('offset'),String(calls));calls++;return Response.json({items:[{...item,line_id:String(calls)}],has_more:calls===1});});assert.equal(got.length,2);
 await assert.rejects(allPages(config,async()=>Response.json({items:[item],has_more:true})),/Duplicate/);
 await assert.rejects(allPages(config,async()=>Response.json({items:[],has_more:false})),/empty result/);
});
test('pull fails on authorization, missing pagination flag and unsafe URLs',async()=>{
 await assert.rejects(getPage(config,0,10,async()=>new Response('',{status:401})),/401/);
 await assert.rejects(getPage(config,0,10,async()=>Response.json({items:[item]})),/has_more/);
 assert.throws(()=>validateEndpoint('https://evil.test/magic-bol'));
});
test('normalization retains partial receipts and requires location matching',()=>{
 const data={warehouses:[{location_code:'123',location_name:'Denton'}]};
 const m=normalizeItems([item,{...item,order_type:'TrnfrOrd',order_number:'TO1'}],data);
 assert.equal(m.errors.length,0);assert.equal(m.pos[0].ordered_quantity,25);assert.equal(m.pos[0].received_quantity,5);assert.equal(m.transfers[0].location_code,'123');assert.match(m.warnings.join(' '),/source location/);
 assert.equal(normalizeItems([{...item,line_location_name:'unknown'}],data).errors.length,1);
 assert.equal(normalizeItems([{...item,raw_quantity:''}],data).errors.length,1);
});
