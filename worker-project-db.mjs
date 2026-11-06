import {neon} from '@neondatabase/serverless';
const valid=value=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export async function requestProjectId(request){
 const url=new URL(request.url);let id;
 if(url.pathname==='/api/template-launch'){
  if(request.method==='POST'){
   const text=await request.clone().text();if(text.length>1024)return null;
   try{id=JSON.parse(text).projectId;}catch{return null;}
  }else{id=url.searchParams.get('project');}
 }
 if(!id)id=request.headers.get('cookie')?.match(/(?:^|;\s*)template_project=([^;]+)/)?.[1];
 return valid(id)?id.toLowerCase():null;
}
export async function projectDatabase(request,env){
 if(env.POC_PROJECT_DATABASES!=='true'||!new URL(request.url).pathname.startsWith('/api/'))return null;
 const projectId=await requestProjectId(request);if(!projectId)return null;
 const sql=neon(env.DATABASE_URL);
 const rows=await sql`SELECT connection_string, environment FROM template_project_databases WHERE project_id=${projectId}::uuid`;
 if(!rows.length)return null; // Preserve existing shared-workspace sessions.
 return {projectId,connectionString:rows[0].connection_string,environment:rows[0].environment};
}
