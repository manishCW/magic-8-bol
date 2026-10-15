import {parseCSV,canonicalUom} from './imports.mjs';
const DAY=86400000;
export function day(v){const s=String(v||'').slice(0,10);const n=Date.parse(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n/DAY:null;}
const iso=n=>new Date(n*DAY).toISOString().slice(0,10);
const key=r=>JSON.stringify([r.po_internal_id,r.po_line_id]);
const truth=v=>['true','t','yes','1'].includes(String(v).toLowerCase());
const number=v=>v!==''&&v!=null&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
export const nonphysicalNames=['Shipping','Sales and Use Tax','Sales Tax - Non CIP','Tax Fees','Professional Service','Security Services','Intercompany Services','Cleaning Service','Interconnection Service','Executive Airline Service','Data Services','Recruitment Services','DEPLOYMENT SERVICES PIT-02','DEPLOYMENT SERVICES POC-02','MAINTAIN SERVICES-02'];
const nonphysical=r=>nonphysicalNames.some(n=>n.toLowerCase()===r.item_number?.toLowerCase())||/^Year-\d .*Maint\. Services Renewal/.test(r.item_number||'');
const excluded=r=>truth(r.line_closed)||truth(r.cancelled)||/closed|cancel|rejected|pending supervisor/i.test(r.po_status);
const fields={pos:['po_internal_id','po_number','po_line_id','vendor_internal_id','vendor_name','item_internal_id','item_number','receiving_location_internal_id','receiving_location_name','requested_receipt_date','ordered_quantity','received_quantity','unit_of_measure','po_status','line_closed','exported_at'],receipts:['receipt_internal_id','receipt_line_id','po_internal_id','po_line_id','item_internal_id','receipt_date','received_quantity','unit_of_measure','voided','exported_at'],changes:['po_internal_id','po_line_id','changed_at','old_requested_receipt_date','new_requested_receipt_date']};
export function importHistory(files){
 const data={};for(const [type,required] of Object.entries(fields)){const parsed=parseCSV(files[type],{maxBytes:25_000_000,maxRows:100000});const missing=required.filter(k=>!parsed.headers.includes(k));if(missing.length)throw Error(`${type}: missing ${missing.join(', ')}`);data[type]=parsed.rows;}
 const seen=new Set();for(const p of data.pos){if(!p.po_internal_id||!p.po_line_id)throw Error('PO IDs and line IDs are required.');if(seen.has(key(p)))throw Error('Duplicate PO / line ID. Export one row per PO line.');seen.add(key(p));if(number(p.ordered_quantity)===null||number(p.received_quantity)===null)throw Error(`Invalid quantity on ${p.po_number}, line ${p.po_line_id}`);if(p.requested_receipt_date&&day(p.requested_receipt_date)===null)throw Error(`Invalid requested date on ${p.po_number}`);}
 const receiptKeys=new Set();for(const r of data.receipts){const k=JSON.stringify([r.receipt_internal_id,r.receipt_line_id]);if(!r.receipt_internal_id||!r.receipt_line_id||receiptKeys.has(k))throw Error('Receipt IDs must be present and unique per receipt line.');receiptKeys.add(k);if(!seen.has(key(r)))throw Error('Receipt refers to a PO line absent from the PO export.');if(day(r.receipt_date)===null||number(r.received_quantity)===null)throw Error('Receipt contains an invalid date or quantity.');}
 for(const c of data.changes){if(!seen.has(key(c))||!Number.isFinite(Date.parse(c.changed_at))||[c.old_requested_receipt_date,c.new_requested_receipt_date].some(d=>d&&day(d)===null))throw Error('Invalid requested-date history row or unknown PO line.');}
 const dates=[...data.pos,...data.receipts].map(r=>day(r.exported_at));if(dates.some(d=>d===null))throw Error('Every PO and receipt needs a valid exported_at timestamp.');const oldest=dates.reduce((a,b)=>Math.min(a,b),Infinity),newest=dates.reduce((a,b)=>Math.max(a,b),-Infinity);if(newest-oldest>1)throw Error('Use PO and receipt exports taken within one day of each other.');
 data.asOf=iso(oldest);data.importedAt=new Date().toISOString();data.version=1;return data;
}
// Conditional Kaplan–Meier completion estimate. Open lines remain censored observations.
// One observation per PO (slowest line within cohort) avoids counting a large PO many times.
export function estimate(samples,age,ownPo){
 const byPo=new Map();for(const s of samples){if(s.po===ownPo)continue;const old=byPo.get(s.po);if(!old||s.duration>old.duration||(s.duration===old.duration&&!s.event))byPo.set(s.po,s);}
 const eligible=[...byPo.values()].filter(s=>s.duration>age);const completed=eligible.filter(s=>s.event).length;
 if(eligible.length<5||completed<3)return {reason:'Fewer than 5 comparable POs still outstanding at this age, or fewer than 3 later completions.',samples:eligible.length,completed};
 const grouped=new Map();for(const s of eligible){const g=grouped.get(s.duration)||{events:0,censored:0};g[s.event?'events':'censored']++;grouped.set(s.duration,g);}
 let risk=eligible.length,survival=1;const q={};for(const [t,g] of [...grouped].sort((a,b)=>a[0]-b[0])){survival*=1-g.events/risk;for(const p of [.25,.5,.75])if(q[p]==null&&1-survival>=p-1e-10)q[p]=t;risk-=g.events+g.censored;}
 if(q[.5]==null)return {reason:'Most comparable POs remain unreceived; history cannot support a median completion date.',samples:eligible.length,completed};
 return {median:q[.5],low:q[.25],high:q[.75]??null,samples:eligible.length,completed};
}
export function forecast(data){
 const today=day(data.asOf),receipts=new Map(),changes=new Map(),warnings={unreconciled:0,invalidReceipt:0,noDate:0,excluded:0,currentDateBasis:0,originalDateBasis:0,nonphysical:0};
 for(const r of data.receipts){if(truth(r.voided))continue;const a=receipts.get(key(r))||[];a.push(r);receipts.set(key(r),a);}
 for(const c of data.changes){const a=changes.get(key(c))||[];a.push(c);changes.set(key(c),a);}
 const samples=[],targets=[];
 for(const p of data.pos){
  const ordered=Number(p.ordered_quantity),received=Number(p.received_quantity),remaining=Math.max(0,ordered-received),current=day(p.requested_receipt_date);
  if(nonphysical(p)){warnings.nonphysical++;continue;}
  if(excluded(p)||ordered<=0){warnings.excluded++;continue;}
  if(current===null){warnings.noDate++;continue;}
  const revisions=(changes.get(key(p))||[]).filter(c=>day(c.changed_at)<=today).sort((a,b)=>a.changed_at.localeCompare(b.changed_at));
  const original=day(p.original_requested_receipt_date)??day(revisions[0]?.old_requested_receipt_date);
  const baseline=original??current,basis=original===null?'Current requested date (original unavailable)':'Original requested date';warnings[original===null?'currentDateBasis':'originalDateBasis']++;
  let sum=0,completion=null,bad=false;const events=(receipts.get(key(p))||[]).sort((a,b)=>a.receipt_date.localeCompare(b.receipt_date));
  for(const r of events){const d=day(r.receipt_date);if(d>today)continue;if(r.item_internal_id!==p.item_internal_id){bad=true;continue;}let qty=Number(r.received_quantity);if(!r.unit_of_measure||!p.unit_of_measure||canonicalUom(r.unit_of_measure)!==canonicalUom(p.unit_of_measure)){const rb=number(r.quantity_in_base_units),pf=number(p.uom_conversion_factor);if(rb!==null&&pf>0&&r.base_unit_of_measure&&canonicalUom(r.base_unit_of_measure)===canonicalUom(p.base_unit_of_measure))qty=rb/pf;else{bad=true;continue;}}
   if(day(p.po_date)!==null&&d<day(p.po_date)){bad=true;continue;}sum+=qty;if(completion===null&&sum+1e-6>=ordered)completion=d;
  }
  const consistent=!bad&&Math.abs(sum-received)<=Math.max(1e-6,received*1e-6);if(bad)warnings.invalidReceipt++;if(!consistent)warnings.unreconciled++;
  const vendor=p.vendor_internal_id,location=p.receiving_location_internal_id;
  if(consistent&&vendor&&baseline<=today){if(remaining===0&&completion!==null)samples.push({po:p.po_internal_id,vendor,location,duration:completion-baseline,event:true,basis});else if(remaining>0)samples.push({po:p.po_internal_id,vendor,location,duration:today-baseline,event:false,basis});}
  if(remaining>0&&current<today)targets.push({id:key(p),po:p.po_number,poId:p.po_internal_id,line:p.po_line_id,item:p.item_number,vendor:p.vendor_name,vendorId:vendor,location:p.receiving_location_name||'Location missing',locationId:location,requested:p.requested_receipt_date,ordered,received,remaining,uom:p.unit_of_measure||'Unknown',daysLate:today-current,baseline:iso(baseline),basis,age:today-baseline,reconciled:consistent});
 }
 const groups=new Map();for(const s of samples){for(const k of ['v:'+s.vendor,'vl:'+s.vendor+':'+s.location]){const a=groups.get(k)||[];a.push(s);groups.set(k,a);}}
 const cache=new Map();const rows=targets.map(t=>{let result={reason:'No matching vendor history.',samples:0,completed:0},cohort='None';if(t.vendorId){for(const [k,label] of [...(t.locationId?[[`vl:${t.vendorId}:${t.locationId}`,'Same vendor and location']]:[]),['v:'+t.vendorId,'Same vendor, all locations']]){const ck=JSON.stringify([k,t.age,t.poId]);if(!cache.has(ck))cache.set(ck,estimate(groups.get(k)||[],t.age,t.poId));result=cache.get(ck);cohort=label;if(result.median!=null)break;}}
  return {...t,cohort,samples:result.samples,completed:result.completed,predicted:result.median==null?null:iso(day(t.baseline)+result.median),earliest:result.low==null?null:iso(day(t.baseline)+result.low),latest:result.high==null?null:iso(day(t.baseline)+result.high),reason:result.reason||'',evidence:result.median==null?'Insufficient':result.samples>=20&&result.completed>=10?'Broader history':'Limited history'};
 }).sort((a,b)=>b.daysLate-a.daysLate||a.po.localeCompare(b.po)||a.line.localeCompare(b.line));
 return {asOf:data.asOf,importedAt:data.importedAt,nonphysicalNames,counts:{poLines:data.pos.length,receiptLines:data.receipts.length,dateChanges:data.changes.length,trainingLines:samples.length,overdueLines:rows.length,overduePOs:new Set(rows.map(r=>r.poId)).size,forecastLines:rows.filter(r=>r.predicted).length},warnings,rows};
}
