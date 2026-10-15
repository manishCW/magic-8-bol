import {readClient,saveClient,getPage,allPages,normalizeItems} from '../../../../../lib/workato-client.mjs';
import {readLimitedJSON} from '../../../../../lib/workato.mjs';
import {readData,transaction} from '../../../../../lib/store.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
export const runtime='nodejs';export const dynamic='force-dynamic';
function local(request:Request,write=false){
 const hosts=['localhost','127.0.0.1','[::1]'];
 try {
  const u=new URL(request.url),host=request.headers.get('host');
  if(!host||!hosts.includes(u.hostname))return false;
  const actual=new URL(`${u.protocol}//${host}`);
  if(!hosts.includes(actual.hostname))return false;
  return !write||request.headers.get('origin')===actual.origin;
 }catch{return false;}
}
export async function GET(request:Request){if(!local(request))return Response.json({error:'Local access only.'},{status:403});try{const c=await readClient();return Response.json({url:c.url,account:c.account,configured:!!c.token},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Could not read connection settings.'},{status:500});}}
const lock=Symbol.for('magic.workato.pull.lock');
export async function POST(request:Request){
 if(!local(request,true))return Response.json({error:'Use the local app to configure or sync.'},{status:403});
 let body;try{body=await readLimitedJSON(request,10000);}catch{return Response.json({error:'Invalid request.'},{status:400});}
 if(!['save','test','sync'].includes(body?.action))return Response.json({error:'Unknown action.'},{status:400});
 const state=globalThis as any;if(state[lock])return Response.json({error:'Another connection operation is in progress.'},{status:409});state[lock]=true;
 try{
  if(body.action==='save')return Response.json(await saveClient(body));
  const config=await readClient(),data=await readData();
  if(body.action==='test'){const page=await getPage(config,0,10);const mapped=normalizeItems(page.items,data);return Response.json({ok:true,count:page.items.length,has_more:page.has_more,errors:mapped.errors.slice(0,10),warnings:mapped.warnings,sample:page.items.slice(0,3)});}
  const extracted=new Date().toISOString(),items=await allPages(config),mapped=normalizeItems(items,data);
  if(mapped.errors.length)return Response.json({error:`${mapped.errors.length} lines need mapping corrections. Existing data retained.`,errors:mapped.errors.slice(0,20)},{status:422});
  return await transaction(async current=>{
   if(current.revision!==data.revision)return {save:false,value:Response.json({error:'Data changed during the pull. Retry sync.'},{status:409})};
   if(current.integration?.account_id&&current.integration.account_id!==config.account)return {save:false,value:Response.json({error:'Account differs from saved NetSuite snapshot. Use a separate data directory.'},{status:409})};
   const root=process.env.WAREHOUSE_DATA_DIR||path.join(process.cwd(),'.data');await fs.mkdir(path.join(root,'backups'),{recursive:true});
   await fs.writeFile(path.join(root,'backups',`before-netsuite-${Date.now()}.json`),JSON.stringify(current),{mode:0o600});
   current.netsuitePos=mapped.pos.map(r=>({...r,account_id:config.account,source:'netsuite'}));current.netsuiteTransfers=mapped.transfers;
   current.presentation=false;current.integration={...current.integration,account_id:config.account,last_success_at:new Date().toISOString(),extracted_at:extracted,line_count:mapped.pos.length,transfer_line_count:mapped.transfers.length,warning_count:mapped.warnings.length,warnings:mapped.warnings,source:'workato-pull'};current.revision++;
   return {save:true,value:Response.json({ok:true,po_lines:mapped.pos.length,transfer_lines:mapped.transfers.length,warnings:mapped.warnings})};
  });
 }catch(e:any){return Response.json({error:e?.code?'Could not save connection or snapshot.':e.message||'Connection failed.'},{status:400});}finally{state[lock]=false;}
}
