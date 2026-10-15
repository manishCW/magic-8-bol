import {importHistory} from '../../../lib/forecast.mjs';
import {readForecast,saveHistory} from '../../../lib/forecast-store.mjs';
import {readLimitedJSON} from '../../../lib/workato.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await readForecast(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Unable to read forecast history.'},{status:500});}}
export async function POST(request:Request){
 const origin=request.headers.get('origin');try{if(origin&&new URL(origin).host!==request.headers.get('host'))return Response.json({error:'Cross-origin imports are not allowed.'},{status:403});}catch{return Response.json({error:'Invalid origin.'},{status:403});}
 try{const files=await readLimitedJSON(request,55_000_000);const data=importHistory(files);return Response.json(await saveHistory(data));}catch(e:any){return Response.json({error:e.message||'Import failed; previous history retained.'},{status:e.status||400});}
}
