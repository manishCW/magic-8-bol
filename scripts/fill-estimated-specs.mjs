import fs from 'node:fs/promises';
import {keyOf,canonicalUom} from '../lib/imports.mjs';
const file='.data/warehouse.json',raw=await fs.readFile(file,'utf8'),data=JSON.parse(raw);
const stamp=new Date().toISOString();
const positive=n=>Number.isFinite(Number(n))&&Number(n)>0;
const unique=new Map();
for(const s of data.skus)if(!s.estimation&&positive(s.unit_weight)&&positive(s.units_per_pallet))unique.set(JSON.stringify([s.item_number,canonicalUom(s.unit_of_measure)]),s);
const pool=[...unique.values()];
const median=a=>{a.sort((a,b)=>a-b);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const index=new Map(data.skus.map(s=>[keyOf('skus',s),s]));
let added=0,updated=0,reused=0,guessed=0;const unresolved=[];
const targets=new Map(data.skus.map(s=>[keyOf('skus',s),s]));
for(const r of [...data.pos,...(data.transfers||[]),...(data.netsuitePos||[])])if(!targets.has(keyOf('skus',r)))targets.set(keyOf('skus',r),{item_number:r.item_number,location_code:r.location_code,unit_of_measure:r.unit_of_measure});
for(const [key,target] of targets){
 const missing=['unit_weight','units_per_pallet'].filter(f=>!positive(target[f]));if(!missing.length)continue;
 const same=unique.get(JSON.stringify([target.item_number,canonicalUom(target.unit_of_measure)]));
 let peers=pool.filter(s=>canonicalUom(s.unit_of_measure)===canonicalUom(target.unit_of_measure));
 let basis='Median of distinct uploaded SKUs with the same UOM; low-confidence placeholder';
 if(!same){for(let n=Math.min(8,target.item_number.length);n>=3;n--){const matching=peers.filter(s=>s.item_number.startsWith(target.item_number.slice(0,n)));if(matching.length>=3){peers=matching;basis=`Median of ${matching.length} distinct uploaded SKUs sharing prefix ${target.item_number.slice(0,n)} and UOM; unverified similarity`;break;}}}
 if(!same&&!peers.length){unresolved.push(key);continue;}
 const s=index.has(key)?target:{...(same||{}),...target};
 for(const field of missing){if(field==='unit_weight'){const lb=same?Number(same.unit_weight)*(same.weight_unit==='kg'?2.2046226218:1):median(peers.map(p=>Number(p.unit_weight)*(p.weight_unit==='kg'?2.2046226218:1)));s.unit_weight=Math.round(lb/(s.weight_unit==='kg'?2.2046226218:1)*1000)/1000;if(!s.weight_unit)s.weight_unit='lb';}else{s.units_per_pallet=Math.max(1,Math.round(same?Number(same.units_per_pallet):median(peers.map(p=>Number(p.units_per_pallet)))));}}
 s.estimation={fields:missing,basis:same?'Same SKU and UOM from uploaded location '+same.location_code:basis,confidence:same?'cross-location reference':'low',updated_at:stamp};
 if(index.has(key))updated++;else{data.skus.push(s);added++;}if(same)reused++;else guessed++;
}
await fs.writeFile('.data/before-sku-estimates-'+stamp.replaceAll(':','-')+'.json',raw,{mode:0o600});
data.revision=(data.revision||0)+1;data.sources.skus='Uploaded specifications + labeled planning estimates · '+stamp;
await fs.writeFile(file+'.tmp',JSON.stringify(data,null,2),{mode:0o600});await fs.rename(file+'.tmp',file);
console.log(JSON.stringify({added,updated,reused,guessed,unresolved:unresolved.length}));
