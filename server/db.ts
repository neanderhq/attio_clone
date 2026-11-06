import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle as nodeDrizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as neonDrizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { Pool } from 'pg';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema';

type RequestContext = object & { databaseDisposers?: Array<() => Promise<void>>; projectDatabaseUrl?: string; templateProjectId?: string; templateEnvironment?: Record<string,string> };
function createDatabase(context?: RequestContext): NodePgDatabase<typeof schema> | NeonDatabase<typeof schema> {
  const connectionString=context?.projectDatabaseUrl || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  if (context && process.env.DATABASE_DRIVER==='neon') {
    neonConfig.webSocketConstructor=WebSocket;
    neonConfig.poolQueryViaFetch=true;
    const pool=new NeonPool({connectionString,max:5,connectionTimeoutMillis:10000});
    context.databaseDisposers?.push(()=>pool.end());
    return neonDrizzle(pool,{schema});
  }
  const pool=new Pool({connectionString,max:5,connectionTimeoutMillis:10000,...(context && !context.databaseDisposers ? {maxUses:1} : {})});
  context?.databaseDisposers?.push(()=>pool.end());
  return nodeDrizzle(pool,{schema});
}
type Database=ReturnType<typeof createDatabase>;
let database: Database | undefined;
const requestDatabases=new WeakMap<object,Database>();
export function getDb():Database {
  let context:RequestContext|undefined;
  try { context=getCloudflareContext().ctx; } catch { /* Ordinary Node runtime. */ }
  if (!context) return database ??= createDatabase();
  let result=requestDatabases.get(context);
  if (!result) { result=createDatabase(context); requestDatabases.set(context,result); }
  return result;
}

export function privateTemplateProject():string|undefined {
 try{return (getCloudflareContext().ctx as RequestContext).templateProjectId;}catch{return process.env.TEMPLATE_PROJECT_ID;}
}

export function runtimeEnv(name:string):string|undefined {
 try{return (getCloudflareContext().ctx as RequestContext).templateEnvironment?.[name] ?? process.env[name];}catch{return process.env[name];}
}
