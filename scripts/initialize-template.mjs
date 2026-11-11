import { Client } from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
await client.connect();
try {
  // No account/password and no access to an existing workspace is created here.
  // ON CONFLICT preserves an operator's decision to disable sample initialization.
  await client.query("INSERT INTO crm_template_settings(id, enabled) VALUES ('attio-starter-v1', true) ON CONFLICT (id) DO NOTHING");
  console.log('Template initialized. New private workspaces receive fictional CRM examples after normal sign-up.');
} finally { await client.end(); }
