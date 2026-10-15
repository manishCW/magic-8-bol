import {createHash,timingSafeEqual} from 'node:crypto';
import {csvText,validateImport} from './imports.mjs';
export class SyncError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function authorized(header,secret){if(!secret||secret.length<32)return false;const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(header||'');return expected.length===actual.length&&timingSafeEqual(expected,actual);}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
export function applySnapshot(data,body,account,now=new Date()){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new SyncError('Expected a JSON object.');
 const requiredText=['batch_id','account_id','extracted_at'];for(const k of requiredText)if(typeof body[k]!=='string'||!body[k].trim()||body[k].length>150)throw new SyncError(`${k} must be a nonempty string of at most 150 characters.`);
 if(body.account_id!==account)throw new SyncError('account_id does not match the configured NetSuite account.',403);
 if(body.complete!==true)throw new SyncError('Send only complete snapshots after fetching every page. complete must be true.');
 if(!Array.isArray(body.records)||body.records.length>10000)throw new SyncError('records must be an array of at most 10,000 PO lines.');
 if(!Number.isInteger(body.expected_count)||body.expected_count!==body.records.length)throw new SyncError('expected_count does not match the number of records.');
 if(!body.records.length&&body.allow_empty!==true)throw new SyncError('Empty snapshots require allow_empty: true after independently verifying zero open lines.');
 const time=Date.parse(body.extracted_at);if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.extracted_at)||!Number.isFinite(time)||time>now.getTime()+300000)throw new SyncError('extracted_at must be an ISO timestamp with timezone, no more than five minutes in the future.');
 const digest=createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
 const history=data.integration?.batches||[];const existing=history.find(b=>b.id===body.batch_id);
 if(existing){if(existing.digest!==digest)throw new SyncError('This batch_id was already used with different content.',409);return {duplicate:true,batch_id:body.batch_id,accepted_count:existing.count,revision:data.revision};}
 if(data.integration?.account_id&&data.integration.account_id!==account)throw new SyncError('Saved data belongs to a different account. Use a separate data directory.',409);
 if(data.integration?.extracted_at&&time<=Date.parse(data.integration.extracted_at))throw new SyncError('Snapshot is older than or equal to the last accepted snapshot.',409);
 const ids=new Set();for(const [i,r] of body.records.entries()){if(!r||typeof r!=='object'||Array.isArray(r))throw new SyncError(`Record ${i+1} must be an object.`);for(const k of ['po_internal_id','line_id'])if(typeof r[k]!=='string'||!r[k].trim())throw new SyncError(`Record ${i+1}: ${k} must be a nonempty string.`);if(typeof r.ordered_quantity!=='number'||typeof r.received_quantity!=='number'||typeof r.closed!=='boolean')throw new SyncError(`Record ${i+1}: quantities must be JSON numbers and closed must be boolean.`);const id=JSON.stringify([r.po_internal_id,r.line_id]);if(ids.has(id))throw new SyncError(`Record ${i+1}: duplicate internal PO/line identifier.`);ids.add(id);}
 let result={rows:[],warnings:[],errors:[]};if(body.records.length){result=validateImport('pos',csvText('pos',body.records),data);if(result.errors.length)throw new SyncError(result.errors.slice(0,15).join(' '));}
 data.netsuitePos=result.rows.map((r,i)=>({...r,po_internal_id:body.records[i].po_internal_id,source:'netsuite',account_id:account}));
 data.integration={account_id:account,extracted_at:body.extracted_at,last_success_at:now.toISOString(),last_batch_id:body.batch_id,line_count:result.rows.length,warning_count:result.warnings.length,batches:[...history,{id:body.batch_id,digest,count:result.rows.length}].slice(-100)};data.revision++;
 return {duplicate:false,batch_id:body.batch_id,accepted_count:result.rows.length,warning_count:result.warnings.length,warnings:result.warnings.slice(0,20),revision:data.revision};
}
export async function readLimitedJSON(request,limit=2_000_000){const reader=request.body?.getReader();if(!reader)throw new SyncError('JSON body required.');const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new SyncError(`Payload exceeds ${limit/1_000_000} MB. No records were saved.`,413);}chunks.push(value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new SyncError('Invalid JSON.');}}
