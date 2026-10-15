import {canonicalUom} from './imports.mjs';
const normalized=v=>String(v??'').trim();
const key=(po,line)=>JSON.stringify([normalized(po),normalized(line)]);
export const planningDate=row=>row.planningDate??row.date;
// Overlay only; source records and requested dates are never rewritten or appended.
export function attachForecasts(lines,history,today,siteName=(v)=>v){
 const index=new Map();for(const f of history?.rows??[]){const k=key(f.po,f.line);index.set(k,index.has(k)?null:f);}
 let matched=0;const rows=lines.map(r=>{
  if(r.orderType!=='PO'||r.closed||r.ordered<=r.received||!r.date||r.date>=today)return r;
  const f=index.get(key(r.po,r.lineId));
  if(!f?.predicted||f.predicted<=(today>history.asOf?today:history.asOf))return r;
  if(r.poId&&normalized(r.poId)!==normalized(f.poId))return r;
  if(normalized(r.item)!==normalized(f.item)||canonicalUom(r.uom)!==canonicalUom(f.uom)||Number(r.ordered)!==Number(f.ordered)||Number(r.received)!==Number(f.received))return r;
  if(![r.site,siteName(r.site)].some(s=>normalized(s)===normalized(f.location)))return r;
  matched++;return {...r,forecast:f};
 });return {rows,matched,total:(history?.rows??[]).filter(f=>f.predicted).length};
}
export function applyForecastDates(rows,enabled){return rows.map(r=>({...r,planningDate:enabled&&r.forecast?r.forecast.predicted:r.date,usesForecast:!!(enabled&&r.forecast)}));}
// Summary workload contains dated upcoming arrivals, plus opted-in forecast lines.
export function arrivalWorkload(rows,today){return rows.filter(r=>!r.closed&&r.ordered>r.received&&planningDate(r)&&planningDate(r)>=today);}
