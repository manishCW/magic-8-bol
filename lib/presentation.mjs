import {keyOf} from './imports.mjs';
// A derived presentation view; original uploaded data is never modified.
export function presentationData(data,today){
 const specs=new Map(data.skus.map(s=>[keyOf('skus',s),s]));
 const locations=new Set(data.warehouses.map(w=>w.location_code));
 const candidates=data.pos.filter(r=>locations.has(r.location_code)&&specs.has(keyOf('skus',r)));
 const selected=candidates.slice(0,48);
 const date=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const pos=selected.map((r,i)=>{const s=specs.get(keyOf('skus',r));const quantity=Math.max(1,Number(s.units_per_pallet)||10)*(2+i%9);return {...r,requested_receipt_date:i%19===0?'':date(i%24-5),ordered_quantity:quantity,received_quantity:i===47?quantity:i%5===0?Math.floor(quantity/3):0,closed:false};});
 const transfers=selected.slice(0,12).map((r,i)=>{const destination=selected.find(x=>x.location_code!==r.location_code)?.location_code||data.warehouses.find(w=>w.location_code!==r.location_code)?.location_code;return {...pos[i],transfer_order_number:'SCENARIO-TO-'+(1001+i),source_location_code:destination,location_code:r.location_code,requested_receipt_date:i===0?'':date(i-3)};}).filter(r=>r.source_location_code);
 const used=new Set([...pos.map(r=>r.location_code),...transfers.flatMap(r=>[r.location_code,r.source_location_code])]);
 const missing=pos[2];
 return {...data,pos,transfers,warehouses:data.warehouses.filter(w=>used.has(w.location_code)),skus:data.skus.filter(s=>!missing||keyOf('skus',s)!==keyOf('skus',missing))};
}
