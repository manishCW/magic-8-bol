'use client';
import {useEffect,useState} from 'react';
export default function NetSuitePanel(){
 const [url,setUrl]=useState(''),[account,setAccount]=useState(''),[token,setToken]=useState(''),[configured,setConfigured]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState<any>(null);
 useEffect(()=>{fetch('/api/integrations/workato/client').then(r=>r.json()).then(d=>{setUrl(d.url||'');setAccount(d.account||'');setConfigured(d.configured);});},[]);
 async function run(action:string){setBusy(true);setResult(null);try{const r=await fetch('/api/integrations/workato/client',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='save'?{action,url,account,token}:{action})});const d=await r.json();setResult(d);if(r.ok&&action==='save'){setToken('');setConfigured(true);}if(r.ok&&action==='sync')window.location.reload();}catch{setResult({error:'Unable to reach the local server.'});}finally{setBusy(false);}}
 return <section className="panel saved-records" id="netsuite-connect"><div className="panel-head"><div><h2>Connect Magic-BOL API</h2><p>Pull purchase and transfer orders from NetSuite through Workato</p></div><span className="badge">{configured?'Token saved · test required':'Awaiting API token'}</span></div><div className="import-body"><div style={{display:'grid',gap:16,maxWidth:850}}>
 <label>Workato endpoint URL<input style={{width:'100%'}} value={url} onChange={e=>{setUrl(e.target.value);setConfigured(false);}}/></label>
 <label>NetSuite account ID<input value={account} placeholder="Account used by the recipe (for example 7258820_SB3)" style={{width:'100%'}} onChange={e=>{setAccount(e.target.value);setConfigured(false);}}/></label>
 <label>Workato API client token<input type="password" autoComplete="off" value={token} placeholder={configured?'Saved securely; leave blank to retain':'Paste the API client token here'} style={{width:'100%'}} onChange={e=>setToken(e.target.value)}/></label>
 <p>The token is saved in a local server-only file excluded from Git. It is never returned by this page. Use the API client token, not a NetSuite client ID or certificate ID.</p>
 <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button disabled={busy||!url||!account} onClick={()=>run('save')}>Save connection</button><button className="secondary" disabled={busy||!configured} onClick={()=>run('test')}>Test connection</button><button disabled={busy||!configured} onClick={()=>run('sync')}>Sync all PO & TO lines</button></div>
 <p>Test reads up to 10 lines without changing order data. Sync retrieves every page and validates it before switching the dashboard to NetSuite. A backup preserves the previous scenario. Automatic polling is not enabled.</p>
 {busy&&<p role="status">Working… large snapshots can take several minutes.</p>}{result&&<div role="status"><p>{result.error||result.configured&&'Connection saved. You can now test it.'||result.ok&&`Connection succeeded. ${result.count??0} sample lines received.`}</p>{result.errors?.map((v:string,i:number)=><p key={i}>{v}</p>)}{result.warnings?.map((v:string,i:number)=><p key={i}>{v}</p>)}</div>}
 </div></div></section>;
}
