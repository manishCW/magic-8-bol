import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {forecast} from './forecast.mjs';
const root=process.env.WAREHOUSE_DATA_DIR||path.join(process.cwd(),'.data');
const file=path.join(root,'arrival-history.json');
let cache;
export async function readForecast(){try{const stat=await fs.stat(file);if(cache?.mtime===stat.mtimeMs)return cache.result;const result=forecast(JSON.parse(await fs.readFile(file,'utf8')));cache={mtime:stat.mtimeMs,result};return result;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
const lock=Symbol.for('warehouse.forecast.queue');
export function saveHistory(data){const job=(globalThis[lock]||Promise.resolve()).then(async()=>{const result=forecast(data);await fs.mkdir(root,{recursive:true});const temp=path.join(root,randomUUID()+'.tmp');try{await fs.copyFile(file,path.join(root,'arrival-history-before-'+Date.now()+'.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,file);cache=null;return result;}finally{await fs.unlink(temp).catch(()=>{});}});globalThis[lock]=job.catch(()=>{});return job;}
