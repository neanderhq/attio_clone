import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../server/db';
import { newSession, sessionCookie } from '../../../server/auth';
import { companies, deals, memberships, notes, people, sessions, tasks, users, workspaces } from '../../../server/schema';

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
    const [workspace] = await tx.insert(workspaces).values({name:'My Attio workspace'}).returning();
    await tx.insert(memberships).values({userId:projectId,workspaceId:workspace.id,role:'Admin'});
    const [company] = await tx.insert(companies).values({workspaceId:workspace.id,name:'Northstar Studio (demo)',description:'Fictional design practice'}).returning();
    const [person] = await tx.insert(people).values({workspaceId:workspace.id,name:'Maya Reed (demo)',email:'maya@example.test',companyId:company.id}).returning();
    const [deal] = await tx.insert(deals).values({workspaceId:workspace.id,name:'Autumn partnership (demo)',companyId:company.id,personId:person.id,stage:'Qualified',owner:'Alex (demo)',valueCents:1250000}).returning();
    await tx.insert(notes).values({workspaceId:workspace.id,targetType:'deal',targetId:deal.id,body:'Fictional example. Discovery call completed.'});
    await tx.insert(tasks).values({workspaceId:workspace.id,targetType:'deal',targetId:deal.id,title:'Send sample proposal'});
    return workspace.id;
  });
  const ticket = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({userId:projectId,tokenHash:digest(`launch:${ticket}`).toString('hex'),expiresAt:new Date(Date.now()+30000)});
  const url=new URL('/api/template-launch',request.url);url.searchParams.set('ticket',ticket);
  return json({url:url.toString(),workspaceId});
}

export async function GET(request: Request) {
  const ticket=new URL(request.url).searchParams.get('ticket') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return json({error:'Invalid ticket'},401);
  const [consumed]=await getDb().delete(sessions).where(and(eq(sessions.tokenHash,digest(`launch:${ticket}`).toString('hex')),gt(sessions.expiresAt,new Date()))).returning();
  if (!consumed) return json({error:'Expired or used ticket'},401);
  const token=await newSession(consumed.userId);
  return new Response(null,{status:303,headers:{...headers,Location:'/', 'Set-Cookie':sessionCookie(request,token)}});
}
