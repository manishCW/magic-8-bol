import {validateImport,mergeRows,importableRows} from '../../../lib/imports.mjs';
import {readData,transaction} from '../../../lib/store.mjs';
import {readLimitedJSON} from '../../../lib/workato.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{const data=await readData();const {batches,...status}=data.integration||{};return Response.json({...data,integration:{...status,configured:!!(process.env.WORKATO_SYNC_TOKEN?.length>=32&&process.env.NETSUITE_ACCOUNT_ID)}},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Unable to read saved data. Existing data has not been overwritten.'},{status:500});}}
export async function POST(request:Request){
 try{const origin=request.headers.get('origin'),host=request.headers.get('host');if(origin&&new URL(origin).host!==host)return Response.json({error:'Cross-origin imports are not allowed.'},{status:403});}catch{return Response.json({error:'Invalid origin.'},{status:403});}
 let body;try{body=await readLimitedJSON(request,2_100_000);}catch(e:any){return Response.json({error:e.message},{status:e.status||400});}if(!body||typeof body!=='object')return Response.json({error:'Expected a JSON object.'},{status:400});
 try{return await transaction(async data=>{if(body.revision!==data.revision)return {save:false,value:Response.json({error:'Data changed in another tab or sync. Reload and preview your file again.'},{status:409})};
 if(!['upsert','replace'].includes(body.mode)||body.mode==='replace'&&!['pos','transfers'].includes(body.type))return {save:false,value:Response.json({error:'Invalid import mode.'},{status:400})};
 const result=validateImport(body.type,body.csv,data);const accepted=importableRows(body.type,body.mode,result);if(!accepted.length)return {save:false,value:Response.json({error:body.mode==='replace'?'Fix all errors before replacing order lines, or choose Add/update to save valid rows.':'No valid records to save.',...result},{status:400})};
 data[body.type]=mergeRows(body.type,data[body.type],accepted,body.mode);data.revision++;data.sources[body.type]=`CSV import · ${new Date().toISOString()}`;
 return {save:true,value:Response.json({data,count:accepted.length,skipped:result.rejectedRows?.length||0,rejectedRows:result.rejectedRows||[],warnings:result.warnings})};});}catch{return Response.json({error:'Could not save the import. Please try again.'},{status:500});}
}
