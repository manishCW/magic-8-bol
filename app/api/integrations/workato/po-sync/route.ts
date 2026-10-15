import {transaction} from '../../../../../lib/store.mjs';
import {authorized,applySnapshot,readLimitedJSON} from '../../../../../lib/workato.mjs';
export const runtime='nodejs';
export async function POST(request:Request){
 const secret=process.env.WORKATO_SYNC_TOKEN,account=process.env.NETSUITE_ACCOUNT_ID;
 if(!secret||secret.length<32||!account)return Response.json({error:'Integration is not configured. Set WORKATO_SYNC_TOKEN and NETSUITE_ACCOUNT_ID on the server.'},{status:503});
 if(!authorized(request.headers.get('authorization'),secret))return Response.json({error:'Unauthorized.'},{status:401});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Content-Type must be application/json.'},{status:415});
 try{const body=await readLimitedJSON(request);const result=await transaction(data=>{const value=applySnapshot(data,body,account);return {save:!value.duplicate,value};});return Response.json(result);}
 catch(e:any){return Response.json({error:e.status?e.message:'Unable to save snapshot. Previous data was retained.'},{status:e.status||500});}
}
