import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../server/schema';
import { seedDemoWorkspace } from '../server/demo-seed';

const workspaceId = process.env.DEMO_WORKSPACE_ID;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!workspaceId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(workspaceId)) throw new Error('Set DEMO_WORKSPACE_ID to an existing fictional-data workspace UUID before seeding.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
async function main() {
  try {
    const created = await drizzle(pool, { schema }).transaction(tx => seedDemoWorkspace(tx, workspaceId!));
    console.log(created ? 'Created fictional CRM examples.' : 'Demo seed already applied; no records changed.');
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
