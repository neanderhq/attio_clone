import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {Client} from 'pg';
import {setTimeout} from 'node:timers/promises';
const origin=process.env.POC_URL;
const launch=async()=>{const r=await fetch(origin+'/api/template-launch',{method:'POST',headers:{authorization:`Bearer ${process.env.POC_LAUNCH_SECRET}`},body:JSON.stringify({projectId:randomUUID()})});assert.equal(r.status,200);return r.json();};
const active=await launch();const expired=await launch();
const token=new URL(expired.url).searchParams.get('ticket');
const hash=createHash('sha256').update('launch:'+token).digest('hex');
const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{
 const {rows}=await db.query('SELECT extract(epoch FROM (expires_at-now()))*1000 AS remaining FROM crm_sessions WHERE token_hash=$1',[hash]);
 const remaining=Number(rows[0].remaining);assert.ok(remaining>90000&&remaining<=120000);
 await db.query("UPDATE crm_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[hash]);
}finally{await db.end();}
assert.equal((await fetch(expired.url,{redirect:'manual'})).status,401);
await setTimeout(35000);
assert.equal((await fetch(active.url,{redirect:'manual'})).status,303,'ticket must remain usable after the old 30s window');
assert.equal((await fetch(active.url,{redirect:'manual'})).status,401);
console.log('PASS: two-minute stored expiry, expired ticket denied, redemption after 35s succeeds once');
