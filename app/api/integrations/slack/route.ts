import {readData,transaction} from '../../../../lib/store.mjs';
import {alertPreview,deliverAlert,slackChannel,slackConfig} from '../../../../lib/slack.mjs';
import {readLimitedJSON} from '../../../../lib/workato.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const data=await readData();const date=new URL(request.url).searchParams.get('date')||(data.presentation?data.presentation_date:new Date().toISOString().slice(0,10));
 return Response.json({configured:slackConfig().configured,channel:slackChannel,preview:alertPreview(data,date),lastDelivery:data.slackNotifications?.lastDelivery??null},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Unable to load notification preview. Check the selected date and saved data.'},{status:400});}
}
export async function POST(request:Request){
 // The current app has no user authentication. Only the local, same-origin UI can send.
 const origin=request.headers.get('origin');const url=new URL(request.url);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||origin!==url.origin)return Response.json({error:'Sending is restricted to the local app. Add authenticated access before deployment.'},{status:403});
 let body;try{body=await readLimitedJSON(request,2000);}catch{return Response.json({error:'Invalid request.'},{status:400});}
 if(!['test','summary'].includes(body?.kind))return Response.json({error:'Invalid notification type.'},{status:400});
 if(!slackConfig().configured)return Response.json({error:'Awaiting the Workato Slack endpoint URL and server token.'},{status:503});
 try{return await transaction(async data=>{
  const now=Date.now(),state=data.slackNotifications??{};
  if(now-(state.lastAttemptAt??0)<60000)return {save:false,value:Response.json({error:'Wait one minute before sending another notification.'},{status:429})};
  const preview=alertPreview(data,body.date),key=`summary:${preview.date}`;
  if(body.kind==='summary'&&(state.delivered??[]).includes(key))return {save:false,value:Response.json({error:'This date’s summary has already been sent.'},{status:409})};
  const text=body.kind==='test'?'Magic 8 BOL — connection test\nThis is a test notification for #test-magic-8-bol. No action required. Automatic alerts have not been enabled.':preview.text;
  data.slackNotifications={...state,lastAttemptAt:now};
  try{await deliverAlert(text);data.slackNotifications.lastDelivery={at:new Date().toISOString(),kind:body.kind,date:preview.date,channel:slackChannel};
   if(body.kind==='summary')data.slackNotifications.delivered=[...(state.delivered??[]),key].slice(-365);
   return {save:true,value:Response.json({ok:true,lastDelivery:data.slackNotifications.lastDelivery})};
  }catch(e:any){return {save:true,value:Response.json({error:e.message},{status:502})};}
 });}catch{return Response.json({error:'Could not confirm or record delivery. Check Workato job history before retrying.'},{status:500});}
}
