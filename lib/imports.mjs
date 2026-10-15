import {lines, specs} from './planning.mjs';
export const schemas = {
 transfers: ['transfer_order_number','line_id','item_number','source_location_code','location_code','requested_receipt_date','ordered_quantity','received_quantity','unit_of_measure','closed'],
 warehouses: ['location_code','location_name','node_type'],
 skus: ['item_number','location_code','unit_of_measure','unit_length','unit_width','unit_height','dimension_unit','unit_weight','weight_unit','units_per_pallet','pallet_length','pallet_width','pallet_height'],
 pos: ['po_number','line_id','item_number','location_code','vendor','requested_receipt_date','ordered_quantity','received_quantity','unit_of_measure','closed']
};
export const canonicalUom=value=>["EA","EACH","PC","ST"].includes(String(value).trim().toUpperCase())?"PC":String(value).trim().toUpperCase();
export const keyOf = (type,r)=>JSON.stringify(type==='warehouses'?[r.location_code]:type==='skus'?[r.item_number,r.location_code,canonicalUom(r.unit_of_measure)]:[type==='transfers'?r.transfer_order_number:r.po_number,r.line_id]);
const optionalPalletFields=['pallet_length','pallet_width','pallet_height'];
export function initialData(){
 return {revision:0, transfers:[], sources:{transfers:'Not imported',...{warehouses:'Sample',skus:'Sample',pos:'Sample'}},warehouses:['Grapevine','Denton','Austin'].map(s=>({location_code:s,location_name:s,node_type:'DC'})),skus:Object.entries(specs).flatMap(([item,s])=>['Grapevine','Denton','Austin'].map(site=>({item_number:item,location_code:site,unit_of_measure:'EA',unit_length:12,unit_width:10,unit_height:8,dimension_unit:'in',unit_weight:s.weight,weight_unit:'lb',units_per_pallet:s.perPallet,pallet_length:48,pallet_width:40,pallet_height:6,pallet_tare_weight:45}))),pos:lines.map(r=>({po_number:r.po,line_id:String(r.id),item_number:r.item,location_code:r.site,vendor:r.vendor,requested_receipt_date:r.date,ordered_quantity:r.ordered,received_quantity:r.received,unit_of_measure:'EA',closed:r.closed}))};
}
export function parseCSV(input, limits={maxBytes:2_000_000,maxRows:10000}){
 if(typeof input!=='string'||input.length>limits.maxBytes)throw Error(`Choose a CSV file smaller than ${limits.maxBytes/1_000_000} MB.`);
 const text=input.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,afterQuote=false;
 const push=()=>{row.push(field);field='';afterQuote=false;};const end=()=>{push();if(row.some(v=>v.trim()!==''))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;}}else field+=c;}else if(c===','){push();}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;end();}else if(c==='"'){if(field!==''||afterQuote)throw Error('Unexpected quote in CSV. Quote fields containing commas.');quoted=true;}else{if(afterQuote)throw Error('Unexpected text after a quoted field.');field+=c;}}
 if(quoted)throw Error('Unclosed quoted field in CSV.');if(field!==''||row.length||afterQuote)end();
 if(rows.length<2)throw Error('The CSV needs a header and at least one data row.');if(rows.length>limits.maxRows+1)throw Error(`Limit each upload to ${limits.maxRows.toLocaleString()} rows.`);
 const headers=rows.shift().map(h=>h.trim());if(new Set(headers).size!==headers.length)throw Error('Duplicate column headers.');
 return {headers,rows:rows.map((values,i)=>{if(values.length!==headers.length)throw Error(`Record ${i+2}: expected ${headers.length} columns, found ${values.length}.`);return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));})};
}
export function validateImport(type,text,data){
 const errors=[],warnings=[];let parsed;
 if(!Object.hasOwn(schemas,type))return {errors:['Unknown import type.'],warnings,rows:[]};
 try{parsed=parseCSV(text);}catch(e){return {errors:[e.message],warnings,rows:[]};}
 const missing=schemas[type].filter(h=>!parsed.headers.includes(h)),extra=parsed.headers.filter(h=>!schemas[type].includes(h)&&!(type==='skus'&&h==='pallet_tare_weight'));
 if(missing.length)errors.push(`Missing columns: ${missing.join(', ')}.`);if(extra.length)errors.push(`Unrecognized columns: ${extra.join(', ')}. Use the template headers.`);
 if(errors.length)return {errors,warnings,rows:[]};
 const seen=new Set(),locations=new Set(data.warehouses.map(r=>r.location_code));
 const skuKeys=new Set(data.skus.map(r=>keyOf('skus',r)));
 const counts=new Map();for(const r of parsed.rows){const k=keyOf(type,r);counts.set(k,(counts.get(k)||0)+1);}
 const validRows=[],rejectedRows=[];
 const rows=parsed.rows.map((original,index)=>{const r={...original};const n=index+2;const rowErrors=[];const err=m=>{const message=`Record ${n}: ${m}`;errors.push(message);rowErrors.push(message);};
  for(const field of schemas[type])if(r[field]===''&&!['node_type','requested_receipt_date'].includes(field)&&!(type==='skus'&&optionalPalletFields.includes(field)))err(`${field} is required.`);
  if(type!=='warehouses'&&!locations.has(r.location_code))err(`unknown location_code "${r.location_code}". Import warehouses first.`);
  if(type!=='warehouses')r.unit_of_measure=r.unit_of_measure.toUpperCase();
  const numeric=type==='skus'?['unit_length','unit_width','unit_height','unit_weight','units_per_pallet','pallet_length','pallet_width','pallet_height']:['pos','transfers'].includes(type)?['ordered_quantity','received_quantity']:[];
  for(const f of numeric){const value=r[f];if(type==='skus'&&optionalPalletFields.includes(f)&&value===''){r[f]=null;continue;}r[f]=Number(value);const zero=['received_quantity','ordered_quantity'].includes(f);if(!/^\d+(\.\d+)?$/.test(value)||!Number.isFinite(r[f])||(zero?r[f]<0:r[f]<=0))err(`${f} must be a ${zero?'nonnegative':'positive'} number without commas.`);}
  if(type==='skus'){r.dimension_unit=r.dimension_unit.toLowerCase();r.weight_unit=r.weight_unit.toLowerCase();if(!['in','cm','m'].includes(r.dimension_unit))err('dimension_unit must be in, cm, or m.');if(!['lb','kg'].includes(r.weight_unit))err('weight_unit must be lb or kg.');if(!Number.isInteger(r.units_per_pallet))err('units_per_pallet must be a whole number.');}
  if(['pos','transfers'].includes(type)){const d=r.requested_receipt_date;if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))err('requested_receipt_date must be a real YYYY-MM-DD date, or blank.');if(!['true','false'].includes(r.closed.toLowerCase()))err('closed must be true or false.');r.closed=r.closed.toLowerCase()==='true';if(r.received_quantity>r.ordered_quantity)warnings.push(`Record ${n}: received exceeds ordered; outstanding quantity will be zero.`);if(!d)warnings.push(`Record ${n}: missing requested date; line will be Unscheduled.`);if(!skuKeys.has(keyOf("skus",r)))warnings.push(`Record ${n}: no matching SKU/location/UOM; weight, dimensions and pallets remain unknown.`);}
  if(type==='transfers'&&!locations.has(r.source_location_code))err('unknown source_location_code. Import the source location first.');
  const key=keyOf(type,r);if(['pos','transfers'].includes(type)?counts.get(key)>1:seen.has(key))err('duplicate record key within the CSV.');seen.add(key);
  if(rowErrors.length)rejectedRows.push({record:n,row:original,errors:rowErrors});else validRows.push(r);return r;
 });return {errors,warnings,rows,validRows,rejectedRows};
}
export function importableRows(type,mode,result){
 if(['pos','transfers'].includes(type)&&mode==='upsert')return result.validRows||[];
 return result.errors.length?[]:result.rows;
}
export function mergeRows(type,current,incoming,mode='upsert'){if(mode==='replace')return incoming;const merged=new Map(current.map(r=>[keyOf(type,r),r]));incoming.forEach(r=>merged.set(keyOf(type,r),r));return [...merged.values()];}
export function csvText(type,rows){const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';return schemas[type].join(',')+'\r\n'+rows.map(r=>schemas[type].map(h=>escape(r[h])).join(',')).join('\r\n');}
export function toPlanning(data){return [...data.pos.map(r=>({orderType:'PO',lineId:String(r.line_id),poId:r.po_internal_id,id:r.po_internal_id?JSON.stringify([r.account_id,r.po_internal_id,r.line_id]):keyOf('pos',r),po:r.po_number,item:r.item_number,name:r.item_number,site:r.location_code,vendor:r.vendor,date:r.requested_receipt_date,ordered:r.ordered_quantity,received:r.received_quantity,closed:r.closed,uom:r.unit_of_measure})),...(data.transfers??[]).map(r=>({id:JSON.stringify(['TO',r.transfer_order_number,r.line_id]),orderType:'TO',po:r.transfer_order_number,item:r.item_number,name:r.item_number,site:r.location_code,sourceSite:r.source_location_code,vendor:r.source_location_code,date:r.requested_receipt_date,ordered:r.ordered_quantity,received:r.received_quantity,closed:r.closed,uom:r.unit_of_measure}))];}
export function importedCalculation(row,skus){const quantity=Math.max(0,row.ordered-row.received);const s=skus instanceof Map?skus.get(JSON.stringify([row.item,row.site,canonicalUom(row.uom)])):skus.find(s=>s.item_number===row.item&&s.location_code===row.site&&canonicalUom(s.unit_of_measure)===canonicalUom(row.uom));if(!s)return {quantity,pallets:null,goods:null,gross:null,tare:null,volume:null,spec:null};const factor=s.weight_unit==='kg'?2.2046226218:1;const inch=s.dimension_unit==='cm'?1/2.54:s.dimension_unit==='m'?100/2.54:1;const pallets=Math.ceil(quantity/s.units_per_pallet),goods=quantity*s.unit_weight*factor;return {quantity,pallets,goods,gross:goods,volume:[s.unit_length,s.unit_width,s.unit_height].every(v=>Number.isFinite(Number(v))&&Number(v)>0)?quantity*s.unit_length*s.unit_width*s.unit_height*inch**3/1728:null,spec:s};}
export function importedTotals(rows,skus){return rows.reduce((a,r)=>{const c=importedCalculation(r,skus);a.pallets+=c.pallets??0;a.weight+=c.goods??0;a.volume+=c.volume??0;a.missing+=c.pallets===null?1:0;return a;},{pos:new Set(rows.map(r=>JSON.stringify([r.orderType??"PO",r.po]))).size,pallets:0,weight:0,volume:0,missing:0});}
