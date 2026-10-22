import { Client } from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const workspaceId = process.env.DEMO_WORKSPACE_ID;
if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) throw new Error('Set DEMO_WORKSPACE_ID to an existing fictional-data workspace UUID before seeding.');
const client = new Client({connectionString:process.env.DATABASE_URL, connectionTimeoutMillis:10000});
await client.connect();
try {
  await client.query('BEGIN');
  const found = await client.query('SELECT id FROM companies WHERE name = $1 AND workspace_id = $2 LIMIT 1', ['Northstar Studio (demo)',workspaceId]);
  if (found.rowCount) { await client.query('COMMIT'); console.log('Demo seed already exists; no records changed.'); }
  else {
    const required = await client.query("SELECT id FROM crm_custom_fields WHERE workspace_id = $1 AND object_type IN ('company', 'person', 'deal') AND required = true AND archived_at IS NULL LIMIT 1", [workspaceId]);
    if (required.rowCount) throw new Error('Demo seed cannot create records while required custom fields exist. Create fictional records through the CRM instead.');
    const c = await client.query('INSERT INTO companies(name,description,workspace_id) VALUES($1,$2,$3) RETURNING id',['Northstar Studio (demo)','Fictional design practice',workspaceId]);
    const p = await client.query('INSERT INTO people(name,email,company_id,workspace_id) VALUES($1,$2,$3,$4) RETURNING id',['Maya Reed (demo)','maya@example.test',c.rows[0].id,workspaceId]);
    const d = await client.query('INSERT INTO deals(name,company_id,person_id,stage,owner,value_cents,workspace_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',['Autumn partnership (demo)',c.rows[0].id,p.rows[0].id,'Qualified','Alex (demo)',1250000,workspaceId]);
    await client.query('INSERT INTO notes(target_type,target_id,body,workspace_id) VALUES($1,$2,$3,$4)',['deal',d.rows[0].id,'Fictional example. Discovery call completed.',workspaceId]);
    await client.query('INSERT INTO tasks(target_type,target_id,title,workspace_id) VALUES($1,$2,$3,$4)',['deal',d.rows[0].id,'Send sample proposal',workspaceId]);
    await client.query('COMMIT'); console.log('Created fictional company, person, deal, note, and task.');
  }
} catch(e) { await client.query('ROLLBACK'); throw e; } finally { await client.end(); }
