import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialData} from './imports.mjs';
const root=process.env.WAREHOUSE_DATA_DIR||path.join(process.cwd(),'.data');
const file=path.join(root,'warehouse.json');
export async function readData(){try{const data=JSON.parse(await fs.readFile(file,'utf8'));return {...data,transfers:data.transfers??[],sources:{...data.sources,transfers:data.sources?.transfers??'Not imported'}};}catch(e){if(e.code==='ENOENT')return initialData();throw e;}}
// One shared queue across route modules in this single-process local application.
const symbol=Symbol.for('warehouse.data.queue');
export function transaction(operation){const previous=globalThis[symbol]||Promise.resolve();const next=previous.then(async()=>{const data=await readData();const result=await operation(data);if(result.save){await fs.mkdir(root,{recursive:true});const temp=path.join(root,randomUUID()+'.tmp');try{await fs.writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}}return result.value;});globalThis[symbol]=next.then(()=>{},()=>{});return next;}
