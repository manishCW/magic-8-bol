import {toPlanning, importedTotals, keyOf} from './imports.mjs';
import {eligible} from './planning.mjs';

export const slackChannel='test-magic-8-bol';
export function slackConfig(env=process.env){
 let url;try{url=new URL(env.WORKATO_SLACK_ALERT_URL);}catch{}
 const valid=!!(url&&url.protocol==='https:'&&url.hostname==='apim.workato.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&env.WORKATO_SLACK_ALERT_TOKEN);
 return {configured:valid,url:valid?url.href:null,token:valid?env.WORKATO_SLACK_ALERT_TOKEN:null};
}
export function alertPreview(data,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Choose a valid receiving date.');
 const live=!data.presentation&&!!data.integration?.last_success_at;
 const rows=eligible(toPlanning({...data,transfers:live?(data.netsuiteTransfers??data.transfers??[]):(data.transfers??[]),pos:live?(data.netsuitePos??[]):data.pos}));
 const index=new Map(data.skus.map(s=>[keyOf('skus',s),s]));
 const arrivals=rows.filter(r=>r.date===date),total=importedTotals(arrivals,index);
 const past=rows.filter(r=>r.date&&r.date<date),unscheduled=rows.filter(r=>!r.date);
 const count=rs=>new Set(rs.map(r=>JSON.stringify([r.orderType,r.po]))).size;
 const source=data.presentation?'DEMO SCENARIO — simulated dates and quantities':live?'NetSuite snapshot':'Saved CSV data';
 const text=[`Magic 8 BOL | Receiving outlook | ${date}`,source,
  `${total.pos} orders expected · ${total.pallets.toLocaleString('en-US')} known estimated pallets · ${Math.round(total.weight).toLocaleString('en-US')} lb estimated goods weight`,
  `${total.missing} arrival lines missing SKU specifications (excluded from pallet/weight estimates).`,
  `${count(past)} open orders with requested dates before ${date}; ${count(unscheduled)} orders have undated lines.`,
  'Requested dates only; forecast arrivals are not included. Pallet tare is excluded.'].join('\n');
 return {text,date,orders:total.pos,pallets:total.pallets,weight:total.weight,missing:total.missing};
}
export async function deliverAlert(text,config=slackConfig(),send=fetch){
 if(!config.configured)throw Error('Workato Slack endpoint and server token are not configured.');
 let response;try{response=await send(config.url,{method:'POST',headers:{'Content-Type':'application/json','api-token':config.token},body:JSON.stringify({text}),redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('Delivery could not be confirmed. Check Workato job history before retrying to avoid a duplicate.');}
 if(!response.ok)throw Error(`Workato returned HTTP ${response.status}. Check recipe jobs and Slack channel access before retrying.`);
}
