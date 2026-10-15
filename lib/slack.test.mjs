import test from 'node:test';
import assert from 'node:assert/strict';
import {alertPreview,slackConfig,deliverAlert} from './slack.mjs';
test('only approved HTTPS Workato host accepts server token',()=>{
 assert.equal(slackConfig({WORKATO_SLACK_ALERT_URL:'https://apim.workato.com/coreweave/alerts',WORKATO_SLACK_ALERT_TOKEN:'secret'}).configured,true);
 for(const url of ['http://apim.workato.com/a','https://example.com/a','https://apim.workato.com.evil.test/a','https://apim.workato.com/a?token=x'])assert.equal(slackConfig({WORKATO_SLACK_ALERT_URL:url,WORKATO_SLACK_ALERT_TOKEN:'secret'}).configured,false);
 assert.equal(slackConfig({}).configured,false);
});
test('summary uses outstanding quantities, distinguishes PO/TO and reports unknown specs',()=>{
 const row={po_number:'123',line_id:'1',item_number:'A',location_code:'X',requested_receipt_date:'2026-10-14',ordered_quantity:25,received_quantity:5,closed:false,unit_of_measure:'EA'};
 const data={presentation:true,pos:[row,{...row,line_id:'2',item_number:'MISSING'},{...row,po_number:'closed',closed:true}],transfers:[{...row,transfer_order_number:'123',ordered_quantity:5,received_quantity:2}],skus:[{item_number:'A',location_code:'X',unit_of_measure:'PC',units_per_pallet:10,unit_weight:2,weight_unit:'lb'}]};
 const p=alertPreview(data,'2026-10-14');assert.equal(p.orders,2);assert.equal(p.pallets,3);assert.equal(p.weight,46);assert.equal(p.missing,1);assert.match(p.text,/DEMO SCENARIO/);
 assert.throws(()=>alertPreview(data,'2026-02-30'));
});
test('delivery uses api-token and disables redirects; failures never report success',async()=>{
 const cfg={configured:true,url:'https://apim.workato.com/coreweave/alerts',token:'secret'};
 await deliverAlert('test',cfg,async(url,options)=>{assert.equal(url,cfg.url);assert.equal(options.headers['api-token'],'secret');assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),{text:'test'});return {ok:true};});
 await assert.rejects(deliverAlert('test',cfg,async()=>({ok:false,status:403})),/HTTP 403/);
 await assert.rejects(deliverAlert('test',cfg,async()=>{throw Error('token=secret');}),e=>!e.message.includes('secret')&&e.message.includes('could not be confirmed'));
});
