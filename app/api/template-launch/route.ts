import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb, privateTemplateProject } from '../../../server/db';
import { newSession, sessionCookie } from '../../../server/auth';
import { companies, deals, memberships, notes, people, sessions, tasks, users, workspaces } from '../../../server/schema';

import sample from '../../../template/sample-data.json';

export const dynamic = 'force-dynamic';
const digest = (value: string) => createHash('sha256').update(value).digest();
const headers = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'};
const json = (body: object, status = 200) => NextResponse.json(body, {status, headers});

export async function POST(request: Request) {
  const secret = process.env.POC_LAUNCH_SECRET;
  if (!secret || !timingSafeEqual(digest(request.headers.get('authorization') || ''), digest(`Bearer ${secret}`))) return json({error:'Forbidden'},403);
  const text = await request.text();
  if (text.length > 1024) return json({error:'Invalid request'},400);
  let projectId: string;
  try { projectId=JSON.parse(text).projectId; } catch { return json({error:'Invalid request'},400); }
  if (typeof projectId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId)) return json({error:'Invalid project'},400);
  const requestedProjectId=projectId;
  const privateProject=privateTemplateProject();
  if(privateProject && privateProject!==projectId)return json({error:'Project mismatch'},403);
  if(privateProject)projectId='00000000-0000-4000-8000-000000000001';
  const db = getDb();
  const workspaceId = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${projectId}))`);
    const [existing] = await tx.select().from(users).where(eq(users.id,projectId));
    if (existing) {
      if (existing.email !== `${projectId}@template.neander.invalid`) throw new Error('Project identity collision');
      const [membership] = await tx.select().from(memberships).where(eq(memberships.userId,projectId));
      return membership.workspaceId;
    }
    // Template identities authenticate through the launch ticket, never a shared password.
    await tx.insert(users).values({id:projectId,email:`${projectId}@template.neander.invalid`,passwordHash:'disabled-template-password'});
    const [workspace] = await tx.insert(workspaces).values({name:sample.workspaceName}).returning();
    await tx.insert(memberships).values({userId:projectId,workspaceId:workspace.id,role:'Admin'});
    const [company] = await tx.insert(companies).values({workspaceId:workspace.id,...sample.company}).returning();
    const [person] = await tx.insert(people).values({workspaceId:workspace.id,...sample.person,companyId:company.id}).returning();
    const [deal] = await tx.insert(deals).values({workspaceId:workspace.id,name:sample.deal.name,companyId:company.id,personId:person.id,stage:sample.deal.stage,owner:sample.deal.owner,valueCents:sample.deal.valueCents}).returning();
    await tx.insert(notes).values({workspaceId:workspace.id,targetType:'deal',targetId:deal.id,body:sample.note});
    await tx.insert(tasks).values({workspaceId:workspace.id,targetType:'deal',targetId:deal.id,title:sample.task});
    return workspace.id;
  });
  const ticket = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({userId:projectId,tokenHash:digest(`launch:${ticket}`).toString('hex'),expiresAt:new Date(Date.now()+120000)});
  const url=new URL('/api/template-launch',request.url);url.searchParams.set('ticket',ticket);if(privateProject)url.searchParams.set('project',requestedProjectId);
  return json({url:url.toString(),workspaceId,expiresInSeconds:120});
}

export async function GET(request: Request) {
  const ticket=new URL(request.url).searchParams.get('ticket') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return json({error:'Invalid ticket'},401);
  const [consumed]=await getDb().delete(sessions).where(and(eq(sessions.tokenHash,digest(`launch:${ticket}`).toString('hex')),gt(sessions.expiresAt,new Date()))).returning();
  if (!consumed) return json({error:'Expired or used ticket'},401);
  const token=await newSession(consumed.userId);
  return new Response(null,{status:303,headers:{...headers,Location:'/', 'Set-Cookie':sessionCookie(request,token)}});
}
