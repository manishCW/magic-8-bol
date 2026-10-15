'use client';
import {useEffect,useState} from 'react';
export default function SlackPanel(){
 const [status,setStatus]=useState<any>(null),[date,setDate]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(value=''){try{const r=await fetch('/api/integrations/slack'+(value?'?date='+encodeURIComponent(value):''),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setStatus(d);setDate(d.preview.date);}catch(e:any){setStatus(null);setMessage(e.message);}}
 useEffect(()=>{load();},[]);
 async function send(kind:string){setBusy(true);setMessage('');try{const r=await fetch('/api/integrations/slack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,date})});const d=await r.json();if(!r.ok)throw Error(d.error);setMessage('Workato confirmed delivery to #test-magic-8-bol.');await load(date);}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}
 return <section className="panel saved-records"><div className="panel-head"><div><h2>Slack notifications</h2><p>#test-magic-8-bol · delivered through Workato</p></div><span className="badge">{status?.configured?'Configured · verify with test':'Setup required'}</span></div><div className="import-body">
 <p>{status?.configured?'Send a test or review and send a receiving summary below.':'The Slack recipe is saved. A Workato admin must publish its authenticated endpoint; the app then needs the endpoint URL and token in server settings.'}</p>
 <p><a href="https://app.workato.com/recipes/83065689" target="_blank" rel="noreferrer">Open Slack alert recipe ↗</a></p>
 <label>Receiving date <input type="date" value={date} disabled={busy} onChange={e=>{setDate(e.target.value);setStatus(null);if(e.target.value)load(e.target.value);}}/></label>
 {status&&<pre style={{whiteSpace:'pre-wrap',lineHeight:1.7,padding:'1rem',background:'var(--surface, #f1f5f9)',borderRadius:12}}>{status.preview.text}</pre>}
 <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="secondary" disabled={busy||!status?.configured} onClick={()=>send('test')}>Send connection test</button><button disabled={busy||!status?.configured} onClick={()=>send('summary')}>{busy?'Sending…':'Send receiving summary'}</button><button className="secondary" disabled={busy} onClick={()=>load(date)}>Refresh status</button></div>
 {message&&<p role="status">{message}</p>}<p>Last confirmed delivery: {status?.lastDelivery?new Date(status.lastDelivery.at).toLocaleString():'None yet'}</p>
 <p>Automatic alerts are not enabled. Summaries include requested arrivals, missing SKU matches and past-date orders. Each date’s summary can be sent once; repeated clicks are rate-limited.</p>
 </div></section>;
}
