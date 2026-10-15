import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {readLimitedJSON} from './workato.mjs';
export const defaultEndpoint='https://apim.workato.com/coreweave/magic-bol-v1/magic-bol';
const root=()=>process.env.WAREHOUSE_DATA_DIR||path.join(process.cwd(),'.data');
const file=()=>path.join(root(),'workato-client.json');
export function validateEndpoint(value){
 let u;try{u=new URL(value);}catch{throw Error('Enter a valid Workato endpoint URL.');}
 if(u.protocol!=='https:'||u.hostname!=='apim.workato.com'||u.port||u.username||u.password||u.search||u.hash||!u.pathname.endsWith('/magic-bol'))throw Error('Use the HTTPS Magic-BOL endpoint on apim.workato.com without query parameters.');
 return u.href;
}
export async function readClient(){try{return JSON.parse(await fs.readFile(file(),'utf8'));}catch(e){if(e.code==='ENOENT')return {url:defaultEndpoint,token:'',account:'7258820_SB3'};throw e;}}
export async function saveClient(input){
 const prior=await readClient();const url=validateEndpoint(input.url),token=String(input.token||prior.token||'').trim(),account=String(input.account||'').trim();
 if(!token||token.length>4096||/[\r\n]/.test(token))throw Error('Enter the API client token.');
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(account))throw Error('Enter the NetSuite account ID used by this recipe.');
 await fs.mkdir(root(),{recursive:true});const temp=file()+'.'+randomUUID()+'.tmp';
 try{await fs.writeFile(temp,JSON.stringify({url,token,account}),{mode:0o600});await fs.rename(temp,file());}finally{await fs.rm(temp,{force:true});}
 return {url,account,configured:true};
}
export async function getPage(config,offset=0,limit=1000,send=fetch){
 if(!config.token)throw Error('Save the Workato API client token first.');
 const u=new URL(validateEndpoint(config.url));u.searchParams.set('limit',String(limit));u.searchParams.set('offset',String(offset));
 let r;try{r=await send(u,{headers:{Accept:'application/json','api-token':config.token},redirect:'error',signal:AbortSignal.timeout(35000),cache:'no-store'});}catch{throw Error('Workato could not be reached or timed out. No snapshot was saved.');}
 if(!r.ok)throw Error(r.status===401?'Workato rejected the token (401). Verify the API client token and endpoint URL.':`Workato returned HTTP ${r.status}. Check its recipe job history.`);
 let body;try{body=await readLimitedJSON(r,5_000_000);}catch{throw Error('Workato returned an invalid or oversized JSON response.');}
 if(!Array.isArray(body.items)||typeof body.has_more!=='boolean')throw Error('Response must contain items (array) and has_more (boolean). Check Return Success mapping.');
 return body;
}
export async function allPages(config,send=fetch){
 const items=[],seen=new Set();let offset=0;
 for(let page=0;page<100;page++){
  const result=await getPage(config,offset,1000,send);
  if(result.items.length>1000||(!result.items.length&&result.has_more))throw Error('Invalid pagination response; no snapshot saved.');
  for(const r of result.items){const key=JSON.stringify([r.order_type,r.order_internal_id,r.line_id]);if(seen.has(key))throw Error('Duplicate order lines across pages. Verify the request offset mapping.');seen.add(key);items.push(r);}
  if(items.length>50000)throw Error('Snapshot exceeds 50,000 lines; no partial snapshot saved.');
  if(!result.has_more){if(!items.length)throw Error('No open lines returned. An empty result will not replace existing data.');return items;}
  offset+=result.items.length;
 }
 throw Error('Pagination did not finish; no partial snapshot saved.');
}
export function normalizeItems(items,data){
 const locations=new Map();for(const w of data.warehouses){for(const v of [w.location_code,w.location_name]){if(!v)continue;const k=String(v).trim();locations.set(k,locations.has(k)&&locations.get(k)!==w.location_code?null:w.location_code);}}
 const locate=r=>locations.get(String(r.line_location_internal_id??''))||locations.get(String(r.line_location_name??'').trim());
 const pos=[],transfers=[],errors=[],warnings=[];
 for(const [i,r] of items.entries()){
  const id=String(r.order_internal_id??''),line=String(r.line_id??''),number=String(r.order_number??''),item=String(r.item_name??'').trim(),site=locate(r),uom=String(r.unit_of_measure??'').trim();
  const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
  const closed=r.line_closed===true||r.line_closed==='T'||r.line_closed==='true';
  const validClosed=[true,false,'T','F','true','false'].includes(r.line_closed);
  const date=String(r.planning_receipt_date??'');
  if(!['PurchOrd','TrnfrOrd'].includes(r.order_type)||!id||!line||!number||!item||!site||!uom||!validClosed||!numeric(r.raw_quantity)||!numeric(r.raw_shipped_received_quantity)||date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)){
   errors.push(`Line ${i+1} (${number||'unknown order'}): ${!site?'receiving location is not matched; ':''}${!uom?'unit of measure is missing; ':''}verify identifiers, date, quantities and closed status.`);continue;
  }
  const row={line_id:line,item_number:item,location_code:site,requested_receipt_date:date,ordered_quantity:Number(r.raw_quantity),received_quantity:Number(r.raw_shipped_received_quantity),unit_of_measure:uom,closed};
  if(r.order_type==='PurchOrd')pos.push({...row,po_number:number,po_internal_id:id,vendor:String(r.vendor_name||'Not supplied by Workato')});
  else transfers.push({...row,transfer_order_number:number,transfer_order_internal_id:id,source_location_code:String(r.source_location_name||'Not supplied by Workato')});
 }
 if(transfers.some(r=>r.source_location_code==='Not supplied by Workato'))warnings.push('Transfer source location is not supplied by this query. Receiving locations are used as returned.');
 if(pos.some(r=>r.vendor==='Not supplied by Workato'))warnings.push('Vendor is not supplied by this query.');
 return {pos,transfers,errors,warnings};
}
