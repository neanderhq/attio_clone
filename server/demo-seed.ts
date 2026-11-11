import { and, eq, sql } from 'drizzle-orm';
import type { getDb } from './db';
import { companies, customFields, dealStageEvents, deals, notes, people, tasks, templateSettings, workspaceSeeds, workspaces } from './schema';

type Transaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
export const DEMO_VERSION = 'attio-starter-v1';
const examples = [
  { company: 'Northstar Studio (demo)', domain: 'northstar.example.test', description: 'Fictional independent design practice', person: 'Maya Reed (demo)', email: 'maya@example.test', deal: 'Brand refresh (demo)', stage: 'Qualified', value: 1250000, task: 'Send sample proposal' },
  { company: 'Juniper Labs (demo)', domain: 'juniper.example.test', description: 'Fictional research and software team', person: 'Alex Rivera (demo)', email: 'alex@example.test', deal: 'Research partnership (demo)', stage: 'Discovery', value: 2400000, task: 'Prepare discovery questions' },
  { company: 'Harbor Works (demo)', domain: 'harbor.example.test', description: 'Fictional sustainable workspace provider', person: 'Sam Patel (demo)', email: 'sam@example.test', deal: 'Workspace launch (demo)', stage: 'Proposal', value: 1850000, task: 'Review launch timeline' },
];

export async function seedNewWorkspace(tx: Transaction, workspaceId: string, ownerId: string) {
  const [setting] = await tx.select().from(templateSettings).where(eq(templateSettings.id, DEMO_VERSION)).limit(1);
  if (setting?.enabled) await seedDemoWorkspace(tx, workspaceId, ownerId);
}

/** Call within the workspace transaction. A stable receipt survives record edits/deletions. */
export async function seedDemoWorkspace(tx: Transaction, workspaceId: string, ownerId?: string) {
  // Serialize retries before inserting the receipt or testing workspace state.
  const existing = await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).for('update');
  if (!existing.length) throw new Error('The fictional-data workspace does not exist.');
  const [receipt] = await tx.select().from(workspaceSeeds).where(and(eq(workspaceSeeds.workspaceId, workspaceId), eq(workspaceSeeds.version, DEMO_VERSION))).limit(1);
  if (receipt) return false;
  const [required] = await tx.select({ id: customFields.id }).from(customFields).where(and(eq(customFields.workspaceId, workspaceId), eq(customFields.required, true), sql`${customFields.archivedAt} is null`)).limit(1);
  if (required) throw new Error('Use the CRM to add examples when required custom fields exist.');
  // Preserve the prior explicit seed's rows and record a receipt, including renamed users' other data.
  const [legacy] = await tx.select({ id: companies.id }).from(companies).where(and(eq(companies.workspaceId, workspaceId), eq(companies.name, examples[0].company))).limit(1);
  if (!legacy) for (const example of examples) {
    const [company] = await tx.insert(companies).values({ workspaceId, name: example.company, domain: example.domain, description: example.description }).returning();
    const [person] = await tx.insert(people).values({ workspaceId, name: example.person, email: example.email, companyId: company.id }).returning();
    const [deal] = await tx.insert(deals).values({ workspaceId, name: example.deal, companyId: company.id, personId: person.id, stage: example.stage, owner: 'Demo team', valueCents: example.value }).returning();
    await tx.insert(dealStageEvents).values({ workspaceId, dealId: deal.id, fromStage: null, toStage: example.stage });
    await tx.insert(notes).values({ workspaceId, targetType: 'deal', targetId: deal.id, body: 'Fictional example for exploring your CRM. Replace it with your own customer details.' });
    await tx.insert(tasks).values({ workspaceId, targetType: 'deal', targetId: deal.id, title: example.task, assigneeId: ownerId });
  }
  await tx.insert(workspaceSeeds).values({ workspaceId, version: DEMO_VERSION });
  return !legacy;
}
