import {projectDatabase} from './worker-project-db.mjs';
import application from './.open-next/worker.js';

export default {
  async fetch(request, env, ctx) {
    let project;
    try { project=await projectDatabase(request,env); }
    catch { return Response.json({error:'Project database unavailable'},{status:503,headers:{'Cache-Control':'no-store'}}); }
    const databaseDisposers = [];
    const requestContext = {
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException: ctx.passThroughOnException.bind(ctx),
      props: ctx.props,
      exports: ctx.exports,
      databaseDisposers,
      projectDatabaseUrl:project?.connectionString,
      templateProjectId:project?.projectId,
      templateEnvironment:project?.environment,
    };
    try {
      const response=await application.fetch(request, env, requestContext);
      if(project && response.status===303 && new URL(request.url).pathname==='/api/template-launch'){
        const result=new Response(response.body,response);
        result.headers.append('Set-Cookie',`template_project=${project.projectId}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`);
        return result;
      }
      return response;
    } finally {
      // These clones access PostgreSQL in API handlers, not deferred SSR streams.
      ctx.waitUntil(Promise.all(databaseDisposers.map(dispose => dispose())));
    }
  },
};
