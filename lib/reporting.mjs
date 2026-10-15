import {planningDate} from './forecast-overlay.mjs';
import {lineIssues,issueLabels} from './issues.mjs';
export function siteMatches(row,sites){return !sites.length||sites.includes(row.site);}
export function workloadGroups(rows,calculate,today,mode){
 const groups=new Map();
 for(const r of rows){
  if(r.closed||r.ordered<=r.received||!r.date)continue;
  const date=mode==='past'?r.date:planningDate(r);
  if(mode==='past'?date>=today:date<today)continue;
  const key=mode==='past'?(r.orderType==='TO'?'TO · '+r.po:r.po):date;
  if(!groups.has(key))groups.set(key,{key,pos:new Set(),pallets:0,weight:0,missing:0,lines:0});
  const g=groups.get(key),c=calculate(r);g.pos.add(JSON.stringify([r.orderType??"PO",r.po]));g.lines++;
  g.pallets+=c.pallets??0;g.weight+=c.goods??0;if(c.pallets===null||c.goods===null)g.missing++;
 }
 return [...groups.values()].map(g=>({...g,pos:g.pos.size})).sort((a,b)=>(mode==='past'?b.pallets-a.pallets:0)||a.key.localeCompare(b.key,undefined,{numeric:true}));
}
export function attentionCsv(rows,calculate,today,siteName,kind=''){
 const headers=['order_number','order_type','line_id','item_number','location_code','location_name','vendor','requested_receipt_date','ordered_quantity','received_quantity','outstanding_quantity','unit_of_measure','estimated_pallets','goods_weight_lb','issues','issue_details','planning_snapshot'];
 const records=[];
 for(const r of rows){
  if(r.closed||r.ordered<=r.received)continue;
  const c=calculate(r),issues=lineIssues(r,c,today);
  if(!issues.length||(kind&&!issues.some(i=>i.type===kind)))continue;
  records.push([r.po,r.orderType??"PO",r.id,r.item,r.site,siteName(r.site),r.vendor,r.date,r.ordered,r.received,c.quantity,r.uom,c.pallets,c.goods,issues.map(i=>issueLabels[i.type]).join('; '),issues.map(i=>i.detail).join('; '),today]);
 }
 const escape=v=>{let s=String(v??'');if(/^[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[headers,...records].map(r=>r.map(escape).join(',')).join('\r\n');
}
