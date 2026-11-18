# Ledger CRM · workspace foundation

Ledger CRM now requires a local email/password account. A new account creates a private workspace; its creator is Admin. An Admin can add an existing account by email as Admin, Member or Viewer. Admin and Member can change records. Viewer can only read. Companies, people, deals, notes and tasks are stored in PostgreSQL and scoped to workspace membership on every CRM request. The public `/api/health` endpoint contains no customer data.

## Local launch

Use Node 24.22.0 and pnpm 11.18.0 (`mise.toml`). From this repository root:

```sh
pnpm install --frozen-lockfile
docker compose -p attio_clone_staging_dev -f compose.dev.yaml up -d --wait
```

Put `DATABASE_URL=postgresql://neander_dev:neander_dev_only@127.0.0.1:55432/neander_dev` in gitignored `.env.local`, changing the port if `PGPORT` is set. An exported `DATABASE_URL` overrides the file. Confirm the database is the local development database before running any migration. The migration adds workspace and account tables and nullable workspace IDs; it does not delete or assign existing records.

```sh
unset DATABASE_URL
node --env-file=.env.local .neander/migrate.mjs
pnpm dev
```

Open http://127.0.0.1:3000, create an account and workspace, then add a company, person and deal. Deals use Lead, Qualified, Discovery, Proposal, Negotiation, Won, and Lost stages. A Lost transition requires a reason. New transitions have a timestamp and history; reopening a won deal clears its current close time while preserving the earlier event. Values use currency minor units, with USD, EUR, GBP, or INR selected per deal. Reports and the Overview show current stage counts, open value and this month's won value by currency, and overdue tasks. Select a report number or stage for its contributing records. Monthly won and overdue calculations use the browser's time zone, shown on the report. Older Won deals have an unknown close date and are excluded from monthly won value. The migration maps old New deals to Lead without inventing earlier history or close dates.

Lists can track existing companies or deals in a separate process. Create a private list and grant an existing workspace member Reader or Editor access, or create a shared list for everyone in the workspace. Add the same record to two lists, set each list entry's stage or note independently, and remove an entry without deleting the record. Each list starts with saved Table and Board views; change a filter, sort, or columns, then choose **Save view** or **Discard**. An opened list and workspace are included in the URL so refreshing restores the selection. Run `pnpm check`, `pnpm build`, `node --env-file=.env.local --import tsx scripts/check-lists-api.ts`, and `node --env-file=.env.local --import tsx scripts/check-reports-api.ts` for focused checks. To add fictional examples to a specific workspace, copy its UUID from the workspace response and run `DEMO_WORKSPACE_ID=<uuid> pnpm seed`. The seed only writes fictional records into that workspace. Stop the local database with `docker compose -p attio_clone_staging_dev -f compose.dev.yaml down` to retain its volume.

## CSV transfer

Signed-in workspace members can export Companies or People from those pages. Admins and Members can import after choosing a UTF-8 CSV, mapping headers, and previewing exact row outcomes. Viewers can export but cannot import. Company imports match lowercase domain; people imports match lowercase email and require a company domain already saved in the same workspace. Existing companies without a domain are not guessed or matched. Ambiguous duplicate identities fail per row. Optional description must be mapped to change it. **Create only** skips identical existing rows but reports conflicting values; **Update only** rejects missing matches; **Create or update** saves changes and reports identical retries as unchanged. The saved response lists every CSV row, action, record ID when known, and error. Import is synchronous and atomic for accepted rows, with per-row validation failures. It is limited to 10 MB, 10,000 data rows, and the existing 500-record limit per collection; there is no background job or durable job status. Imports from the same workspace are serialized and recheck matches before writing. Exported text that could run as a spreadsheet formula receives a leading apostrophe, so importing an exported formula-like value back may preserve that apostrophe. Run `node --env-file=.env.local --import tsx scripts/check-csv-api.ts` against a confirmed local development database. The additive migration adds nullable company domain; it does not assign domains to old records.

## Record editing

Open a Company, Person, or Deal to edit its details, or edit an existing Note beside the record. Each save sends the version shown when editing began. If someone else saved first, the server returns HTTP 409 and the editor keeps the attempted values; choose **Load latest version, keep draft**, review the latest record, then save again. Removing a Note also checks its version. An unchanged save does not add history or advance the version. Deal stage changes also require the version, retain the Lost reason rule, and continue to record stage transitions. The change history shows the member, time, and prior/new values for edited attributes. It starts with this migration; older changes cannot be reconstructed. The history view currently shows the first 500 changes per record. Company domains and person emails are matched case-insensitively within a workspace; duplicate identities are rejected. Existing duplicate identities are not merged automatically. CSV updates also advance versions and record attribute changes. Person reassignment is refused when that person has deals at their current company. Run `node --env-file=.env.local --import tsx scripts/check-record-edits.ts` against the confirmed local development database. Migration `0007` adds version columns and the change log without modifying old record values.

## Tasks and notifications

Add a task from a Company, Person, or Deal, optionally assigning it to an existing workspace member. **Tasks** has My and Team views with Overdue, Today, Upcoming, No due date, and Completed filters. Dates use the browser's local day. Tasks can be edited from the record or Tasks page; saving a stale version returns HTTP 409 and keeps the attempted fields until **Load latest version, keep draft** is chosen. Completion uses the same version rule, so two members cannot silently overwrite each other's edits. Existing tasks remain unassigned after migration `0008`.

Assigning a task to another member creates one saved in-app notification for that assignment event. Reassigning it to the same person, an unchanged save, or assigning it to yourself creates none. **Notifications** shows the recipient's latest 200 assignment events and lets that recipient mark one read; Viewers may read and mark their own notifications but cannot edit tasks. Removing a task removes its assignment notifications. Notifications are workspace-scoped and do not use email or push delivery. Notes are displayed as escaped plain text with line breaks; rich formatting, comments, and `@mentions` are deferred, and no mention notifications are claimed. Run `node --env-file=.env.local --import tsx scripts/check-productivity.ts` against the confirmed local development database.

## Custom fields

An Admin can open **Fields** and add workspace-specific Company, Person, or Deal fields. The supported types are text (500 characters), finite number (absolute value at most 1 trillion), checkbox, date, email, domain, HTTP(S) URL without credentials, and single select (2–30 fixed options). Admins can mark a field unique; uniqueness is case-insensitive for text values. A required field may be added only while that record type has no records, because older records have no value to backfill. Required fields must be filled when creating records and cannot later be cleared. CSV creation for a type with required custom fields returns HTTP 409; CSV updates and exports still work. Custom field changes use the record version and reject stale saves with HTTP 409. Archived fields and their saved values remain visible, but their values cannot be edited. Field IDs remain stable. Field types, select options, required and unique rules cannot be changed after creation; archive and add a new field instead. Each record type supports up to 32 active fields.

This is a bounded custom field slice. Currency, timestamp, phone, multi select, ordered status, user reference, and record reference are not implemented. Custom fields are not yet columns, filters, or sorts in saved list views, reports, or CSV exports; there is no backfill tool or custom-field change history. Migration `0009` only adds field and value tables. Run `node --env-file=.env.local --import tsx scripts/check-custom-fields.ts` against the confirmed local development database.

## Record merge and Trash

Open a Company, Person, or Deal to **Review merge** into another active record of the same type. The preview lists differing record fields, affected links, notes and tasks, and visible list memberships. Every differing field and conflicting list entry needs an explicit choice. The server checks the preview again before saving; a changed record or list returns HTTP 409 for a fresh review. A merge moves source notes, tasks, linked people/deals, and list memberships in one transaction, keeps the source row as a redirect, and records an actor and timestamp in the lifecycle audit log. A merge involving a private list requires the acting member to have Editor access to that list; inaccessible private list names are not returned. The source cannot be restored after a merge. Old record URLs containing `recordType` and `recordId` resolve to the surviving record for members of that workspace.

**Move to Trash** soft-deletes a record without deleting its notes, tasks or list memberships. Active lists, reports, CSV, and record pages hide it; workspace Admins and Members can restore it from **Trash** within 30 days. Restoring checks domain/email and unique custom-field collisions, and requires linked company/person records to be active. A Company with active people or deals, or a Person with active deals, must have those links moved or merged before deletion. The 30-day limit ends restore eligibility; rows are retained in the database rather than purged automatically. Historical stage events of a merged source deal remain stored under its old ID and appear separately beneath the survivor's stage timeline. There is no bulk merge, bulk restore, or undo of a merge. Migration `0010` only adds nullable deletion/redirect columns and an audit table. Run `node --env-file=.env.local --import tsx scripts/check-record-lifecycle.ts` against the confirmed local development database.

## Existing data and limits

Rows that predate the workspace migration remain stored with a null workspace ID and are invisible through the authenticated CRM. No automatic ownership is inferred. Back up the database and explicitly assign those rows to the correct workspace before using them; assign linked companies, people, deals, notes and tasks together. Do not assign private records to a public fictional demo workspace. The application still uses integer record IDs internally and in the API; converting them to opaque public IDs needs a separate compatible migration. Workspace and account IDs are UUIDs.

This is a bounded P0 core: linked records, stage history from this migration onward, current reports, plain-text notes, assigned and versioned tasks, in-app assignment notifications, local sign-in, workspaces, three roles, company/deal lists, list-only stage and note, private creator grants, saved table/board view settings, the bounded custom fields above, reversible record deletion and reviewed same-type merge, and synchronous Companies/People CSV transfer. Reports do not include list entries or private lists. A Viewer remains read-only even with an Editor list grant. Private lists are visible only to their creator and explicitly granted workspace members. An Admin has no private-list override or list-access audit trail yet; creator access recovery requires a later audited admin workflow. Lists currently have fixed entry fields and two default views; there is no list deletion or grant revocation UI. Reports are current-state summaries rather than historical pipeline snapshots or forecasts. It is not a production-ready CRM yet. It does not include account recovery, email verification, invitations to unregistered people, custom fields in saved views, CSV transfer for deals or tasks, large asynchronous imports, advanced reporting, automation, AI or connected integrations. Plan account recovery and operational safeguards before production use. `pnpm seed` requires an explicit workspace ID and is for fictional data only. If a public fictional demo is needed, use a dedicated workspace and demo account; do not make the private CRM API anonymous again.

The production recipe is `.neander/compose.yaml`: Publish provisions Neon `DATABASE_URL` and applies committed Drizzle migrations before rollout. Local PostgreSQL checks do not establish managed Neon connectivity. See `docs/deployment-contract.md`.

## Neander template library

This repository provides the **Customer CRM** template. Its shared CI verifies the
production image and publishes completed releases on `main`. Template
initialization enables fictional examples for newly created private workspaces;
users create their own account through the normal app flow. There is no shared
demo password. See [the template integration guide](docs/template-integration.md)
for seed behavior, verification and organization setup.

## License

[MIT](LICENSE). Third-party components retain their respective licenses and
existing attribution notices.

## Public CI and Neander releases

Public CI installs locked dependencies, checks types/syntax, runs app tests and
builds the application. It requires no Neander publishing credentials or private
tools. Neander's private release workflow separately verifies the committed
application image with a disposable database, then publishes it to the template
catalog. Existing projects continue through normal editing and Publish.
