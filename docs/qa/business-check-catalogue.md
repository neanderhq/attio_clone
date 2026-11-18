# Folio business-check catalogue

**Purpose:** agree what supported business logic should do **before execution**. This is a bounded catalogue, not a claim of complete CRM coverage, a screenshot-parity assessment, or an execution report.

**Execution state:** all executable checks below are **NOT RUN** for this catalogue. Source inspection establishes intended/current implementation rules, not deployed behavior. Earlier conversation results are not imported as passes. Unavailable features are explicitly **NOT IMPLEMENTED**.

## How to use this catalogue

IDs such as `BC-ID-001` are permanent references: do not renumber or reuse them when checks change. Each row describes an action and observable expected outcome. A row passes only when all its stated outcomes are evidenced. Record blocked steps and partial coverage rather than inferring success from a command exit code, a success toast, or a screenshot.

### Execution lanes

| Lane | Where and how | Boundary |
| --- | --- | --- |
| **P — published fictional workspace** | Small, sequential checks through the published application's normal UI, using a dedicated `Business QA — <run label>` workspace and fictional records. Reload/reopen to establish persistence. | Verify the selected workspace before every write. Use only tester-controlled accounts and records. No existing customer data, real messages, integrations, bulk fixtures, direct database access, or irreversible merge. |
| **L — local regression only** | Confirmed local development database; isolated, disposable fixtures; existing route-handler scripts or an explicitly added focused check. | Required for races, deliberately inconsistent/legacy fixtures, boundary-volume tests, timestamp manipulation, irreversible merge and destructive cleanup. Never point these scripts at the published database. |
| **N — not implemented** | Scope declaration only. | Not a passing test, and not part of the executable pass-rate denominator. |

Lane P permits removing a **test-created list entry**, because that leaves the CRM record intact. This catalogue conservatively reserves record Trash/restore, note/task deletion, field archival, and merge execution for L even though some are available in the published UI. A lane labels a scenario, not the existing script: **all eight database-backed scripts listed below are local-only**, including scripts that cover P-equivalent rules.

If the published UI cannot perform an intended step, mark that UI check blocked or failed with evidence. A separately authorized HTTP check must be recorded as **HTTP**, not as a UI pass. Do not probe other users' workspaces or infer UI coverage from API success. Access-negative checks use only tester-owned accounts/workspaces and known fixture IDs; they are not penetration testing.

### Small fictional dataset and order

1. Use an authenticated tester account; create a fresh, clearly labeled QA workspace. Provision tester-controlled Admin, Member and Viewer accounts plus a separate tester-owned workspace for isolation checks. No account details, passwords, session cookies or database connection strings belong in this document or results.
2. Before creating records, define any required custom fields. Keep CSV creation checks in another fresh QA workspace without required fields for the imported type.
3. Create `Cedar Demo` (`cedar.example`), `Harbor Demo` (`harbor.example`), and fictional people such as `Mira Demo` (`mira@cedar.example`). Add a per-run suffix to identities if reusing a workspace. Domains and addresses are inert sample data; send nothing.
4. Link a small number of deals, notes and tasks. For reports, use USD 100.00, EUR 200.00, GBP 30.00 and INR 400.00 as separate values, not an exchange-rate calculation. Deal API values are integer minor units (100.00 is 10000); the UI displays units.
5. Use yesterday, today, tomorrow and no due date relative to the browser's recorded time zone. Create two lists of the same record type for independent-process checks. Never fill a published collection to its limit.
6. Check ordinary creation, edits and relationships, then stages/reports, tasks/notes, lists, fields, CSV and role visibility. Run local lifecycle/concurrency scenarios separately with their own fixtures. Retain a safe fixture inventory; do not use database cleanup on the published site.

Practical process names—qualification, onboarding, renewal, account health, partner development and investor tracking—are examples of lists, notes, fields and tasks, **not separate automated engines**. List stages are fixed; a named process does not add bespoke pipeline logic.

## Source map and evidence keys

Links are relative to this file. Code and scripts below were inspected to build the expectations. A script link means **related assertions exist**, not that every row is automated or has run.

| Key | Runtime rules and UI callers | Existing focused check |
| --- | --- | --- |
| **AUTH** | [authentication route](../../app/api/auth/route.ts), [workspace/role guard](../../server/auth.ts), [workspace selection and membership UI](../../app/page.tsx) | [CRM API](../../scripts/check-crm-api.ts) |
| **CRM** | [CRM route](../../app/api/crm/route.ts), [record editor](../../app/record-editor.tsx), [creation/stage handlers](../../app/page.tsx), [shared stages/currencies](../../shared/crm.ts) | [CRM API](../../scripts/check-crm-api.ts), [record edits](../../scripts/check-record-edits.ts) |
| **TASK** | [CRM task writes](../../app/api/crm/route.ts), [notification route](../../app/api/productivity/route.ts), [task buckets/editor](../../app/productivity-section.tsx), [Home tasks](../../app/workspace-ui.tsx) | [productivity](../../scripts/check-productivity.ts) |
| **REPORT** | [report route](../../app/api/reports/route.ts), [aggregation/date rules](../../server/reports.ts), [report UI](../../app/reports-section.tsx), [deal history route](../../app/api/deals/history/route.ts) | [reports API](../../scripts/check-reports-api.ts) |
| **LIST** | [list route](../../app/api/lists/route.ts), [shared list stages/view configuration](../../shared/lists.ts), [list UI](../../app/lists-section.tsx) | [lists API](../../scripts/check-lists-api.ts) |
| **FIELD** | [field route](../../app/api/custom-fields/route.ts), [normalization/validation](../../server/custom-fields.ts), [shared field kinds](../../shared/custom-fields.ts), [field UI](../../app/custom-fields-section.tsx) | [custom fields](../../scripts/check-custom-fields.ts) |
| **CSV** | [CSV route](../../app/api/csv/route.ts), [row planning/matching](../../server/csv-transfer.ts), [shared types/parser/export escaping](../../shared/csv.ts), [CSV UI](../../app/csv-section.tsx) | [CSV API](../../scripts/check-csv-api.ts) |
| **LIFE** | [lifecycle route](../../app/api/records/lifecycle/route.ts), [transactional lifecycle rules](../../server/record-lifecycle.ts), [merge/Trash UI](../../app/record-lifecycle-section.tsx), [schema](../../server/schema.ts) | [record lifecycle](../../scripts/check-record-lifecycle.ts) |
| **VIEW** | [record selection types/logic](../../shared/record-views.ts), [collection/search UI](../../app/workspace-ui.tsx) | [record-view unit tests](../../shared/record-views.test.ts) |
| **HISTORY** | [attribute history route](../../app/api/records/history/route.ts), [history/editor UI](../../app/record-editor.tsx) | [record edits](../../scripts/check-record-edits.ts) |

The normal flow is: UI supplies session plus selected workspace → route validates membership and input → database transaction saves/checks versions and relationships → UI reloads authorized data. Lists store independent entries around canonical records. Reports aggregate current active deals/tasks, not list-entry stages. The [README](../../README.md) describes the supported product slice and operating limits; design-pack examples are not evidence that an integration exists.

## 1. Company/person identity and duplicates

Identity here means an optional canonical **company domain** or **person email**, not a fuzzy name match. Normalization trims surrounding whitespace and lowercases identity values. It does not strip `https://`, `www.`, URL paths or email aliases, or merge pre-existing duplicates automatically.

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-ID-001 | P | Create a company with spaced name and ` Cedar.Example ` domain; reopen it. | Name is trimmed; domain persists as `cedar.example`. A valid manual company may omit domain. | CRM |
| BC-ID-002 | P | Create another company with the same domain in different case; also try changing another company's domain to it. | Duplicate is rejected (HTTP 409 where observed); original records and links remain unchanged. Same display names alone are not duplicate identity. | CRM |
| BC-ID-003 | P | Create a person with ` MIRA@CEDAR.EXAMPLE ` at the saved company; retry identity on create/edit. | Email persists lowercase/trimmed; another active person with that email is rejected within the workspace. Manual email is optional, but company is required. | CRM |
| BC-ID-004 | P | Try malformed domain/email and blank required names; correct the form. | Clear validation prevents invalid saves; valid corrections save. Domain expects a hostname, not a website URL. Company/person names must be 1–120 trimmed characters. | CRM |
| BC-ID-005 | P | Use the same fictional domain/email in a second tester-owned workspace. | Identities may exist independently; records do not appear in the other workspace. Do not expect global deduplication. | CRM, AUTH |
| BC-ID-006 | L | Concurrently create the same domain, or edit two companies/people toward one canonical identity. | Exactly one competing identity write succeeds; the other returns 409. No duplicate active identity is created by the race. | Record-edit script under CRM |
| BC-ID-007 | L | Prepare legacy duplicate identities for import matching. | Import reports ambiguity rather than arbitrarily choosing or merging a record. These fixtures must not be created on the published database. | CSV |

## 2. Relationship integrity and ordinary edits

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-REL-001 | P | Create company → person → deal, then open each linked record and reload. | Person belongs to selected company; deal links to both that company and its person. Details and collection relationship counts reconcile. | CRM, VIEW |
| BC-REL-002 | P | Change the deal's company in the editor. | Person selection clears and offers only people at the chosen company; save requires a compatible person. | CRM, record editor |
| BC-REL-003 | P | Reassign a person without deals to another company; then try reassigning a person with deals. | First saves; second is rejected with the instruction to move the person's deals first. No broken deal-company-person relationship remains. The implementation checks all linked deal rows, not only active ones. | CRM |
| BC-REL-004 | L | Use controlled invalid/mismatched or other-workspace links for a person, deal, note and task. | Writes are refused and create no partial record/link. Deal person must belong to deal company. Status expectations are route-specific; see the unresolved discrepancy below. | CRM, TASK |
| BC-REL-005 | P | Edit a company description, person name and deal attributes; then save identical values again. | Changed values persist and versioned attribute history records actor/time and old/new values. Unchanged saves do not advance version or add attribute history. | CRM, HISTORY |
| BC-REL-006 | L | Save two edits using the same company/deal version; retry from refreshed data. | One save wins; stale save receives 409 and cannot silently overwrite it. Fresh reviewed retry may save. | Record-edit script under CRM |

**Expectation discrepancy to preserve, not mask:** [check-crm-api.ts:57](../../scripts/check-crm-api.ts#L57) expects **404** for a cross-workspace company link on person creation (also repeated later in that script). Current [CRM person creation](../../app/api/crm/route.ts#L86) checks the active linked company within its transaction and throws **409**, `The linked company changed. Review the person and try again.` This explains the earlier reported `409 !== 404` without establishing any new execution result. Keep the intended business assertion—no foreign link or partial person—and record the HTTP-contract mismatch separately. Do not change the test expectation just to obtain green output; later assertions in that script are not covered if it stops here.

## 3. Deals, stages, closing and reporting

Shared stages are **Lead, Qualified, Discovery, Proposal, Negotiation, Won, Lost**. Supported currencies are **USD, EUR, GBP, INR**. There is no enforced sequential qualification gate: moving through the stages below is a practical check, not a required transition order. Deal owner is a required free-text label, not a membership-backed assignment like task assignee.

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-DEAL-001 | P | Create a deal and progress Lead → Qualified → Discovery → Proposal → Negotiation. | Each selected stage persists after reload and has a timestamped transition. Collection board/table and record detail agree. | CRM, REPORT |
| BC-DEAL-002 | P | Attempt Lost with no/whitespace reason; cancel, then submit a meaningful reason. | Empty reason is refused and stage remains unchanged. Valid 1–500-character reason persists with the Lost transition. Cancel does not close the deal. | CRM |
| BC-DEAL-003 | P | Mark Won, reopen to an open stage, then mark Won again. | Won sets current close time; reopening clears it and removes current monthly won contribution; re-winning sets a new close time. Prior events remain. Leaving Lost clears current reason but preserves the historic reason. | CRM, REPORT |
| BC-DEAL-004 | P | Re-select the existing stage/save unchanged deal. | No duplicate stage event, no new close time and no version increment for an entirely unchanged save. | CRM, REPORT |
| BC-DEAL-005 | P | Save zero and small decimal amounts in each supported currency; try negative value. | Valid values round-trip in displayed units/correct currency. Negative value is refused. Currency totals are never added into a mixed-currency grand total. | CRM, REPORT |
| BC-DEAL-006 | L | Supply unsupported stage/currency or fractional/negative/out-of-range minor units. | Validation refuses invalid values; accepted minor-unit range is integer 0–2147483647. No transition/history side effect on refusal. | CRM |
| BC-RPT-001 | P | Create open deals USD 100.00 and EUR 200.00, plus GBP/INR examples; mark USD Won. | Open totals exclude Won and Lost. USD monthly won gains 100.00, EUR open stays 200.00, other currencies stay separate. Use before/after deltas if workspace is not empty. | REPORT |
| BC-RPT-002 | P | Open stage, open-value, won-month and overdue drilldowns. | Contributing record IDs/counts and sums reconcile with the selected metric/currency. Viewer may read. List entries do not contribute to report totals. Browser time zone and reporting month are shown. | REPORT |
| BC-RPT-003 | L | Exercise month/day boundaries in multiple time zones using a fixed clock; include a legacy Won deal without close time. | Month membership follows the requested valid time zone, not server-local time. Legacy unknown close date is disclosed and excluded from monthly wins. Invalid time zone is rejected. | REPORT |

Reports are current-state summaries, not historical pipeline snapshots, forecasts, currency conversion, or revenue accounting. A closed deal's value/currency edits affect its current contribution.

## 4. Tasks, due dates, assignments and notifications

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-TASK-001 | P | Create a linked task; change title/date; complete and reopen it; reload from record and Tasks. | Both surfaces agree on saved values and completion. Completed tasks leave open/overdue buckets; reopening returns them to their date-based bucket. | TASK, REPORT |
| BC-TASK-002 | P | Create tasks due yesterday/today/tomorrow and without a date. | In browser-local days they appear as Overdue/Today/Upcoming/No due date. Today is not overdue. Completed overrides date bucket. Overdue report excludes completed/no-date tasks. | TASK, REPORT |
| BC-TASK-003 | P | Assign a task to another controlled member, self, and nobody; inspect My/Team and Home. | My/Home show the signed-in user's assigned tasks (Home only open tasks); Team includes workspace tasks, including unassigned. Assignee is an existing workspace member, unlike deal owner label. | TASK |
| BC-TASK-004 | P | Assign to another member, repeat same assignment, then assign away and back. | First assignment generates one persisted in-app notice for recipient; same assignment/no-op/self assignment creates none. Assigning back to the other member creates a new event. No email or push is sent. | TASK |
| BC-TASK-005 | P | As recipient, read/mark notice read twice; use controlled non-recipient account for visibility comparison. | Recipient sees their workspace inbox/unread count, read state persists, repeat mark-read succeeds. Other accounts cannot see or mark that notice. Viewer can read/mark own notices but cannot edit tasks. | TASK |
| BC-TASK-006 | L | Try impossible date (for example February 30), invalid completion type, foreign assignee/target, and competing edits using one version. | Validation/link refusal leaves task unchanged. Concurrent edits yield one success and one 409; no silent loss of title/date/assignment/completion. | TASK |
| BC-TASK-007 | L | Remove task with stale version, then current version. | Stale removal returns 409; current removal succeeds and removes assignment notifications. Note/task deletion is not the record Trash workflow. | TASK, CRM |

## 5. Notes and version conflicts

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-NOTE-001 | P | Add multiline context to a company/person/deal, edit it and reopen from Notes index. | Saved plain text stays attached to the correct record, line breaks remain, and edit history identifies actor/time and old/new body. Text resembling formatting remains text; no rich text or mention notification is implied. | CRM, HISTORY, TASK |
| BC-NOTE-002 | P | Try an empty note; save an unchanged existing note. | Empty/whitespace or over-2000-character body is invalid; identical save adds no history/version. Browser maximum length may prevent entering an oversized body. | CRM |
| BC-NOTE-003 | L | Save note in one editor, then submit another draft based on old version; use **Load latest version, keep draft** and review/retry. | Server returns 409 on stale save. UI retains attempted body, loads latest version for review, and only explicitly reviewed retry replaces it. API assertion alone does not prove UI draft retention. | CRM, record editor, record-edit script |
| BC-NOTE-004 | L | Delete an edited note with its old version, then current version. | Old version returns 409 and preserves note; current removal succeeds. Do not claim note deletion can be restored through record Trash. | CRM |

## 6. Lists: independent processes and saved views

Lists support **Companies or Deals**, not People. Entry stages are **New, In progress, Done**, independent of deal pipeline stages. Each new list has saved **Table** and **Board** views.

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-LIST-001 | P | Add one deal to two lists. Change stage/note in only the first list; reload both plus the deal. Repeat with company lists. | Two distinct entries; first entry changes, second stays unchanged. Canonical company/deal details and deal pipeline stage do not change. | LIST |
| BC-LIST-002 | P | Try adding the same record twice to one list. | UI omits existing record from add choices; duplicate submission, if observed through an authorized check, returns 409. Only one entry exists; another list may contain that record. | LIST |
| BC-LIST-003 | P | Change filter/sort/columns, select **Discard**, then change and **Save view**; reopen/reload. | Draft changes are labeled unsaved. Discard restores saved settings. Save persists selected view settings; Table and Board keep separate configurations. Name column stays present. No claim that arbitrary new views can be created. | LIST |
| BC-LIST-004 | P | Open a list URL, refresh, and switch workspace through settings. | Refresh restores accessible workspace/list selection; switching workspace clears old selection and does not display the prior workspace's entries. | LIST, AUTH |
| BC-LIST-005 | P | Remove one test-created entry from one list. | Confirmation explains that record remains. Entry disappears only from that list; canonical record and membership in other list remain. Re-adding is possible as a new entry. | LIST |
| BC-LIST-006 | P | Create private/shared lists and grant Reader/Editor to controlled workspace accounts. | Shared list readable to workspace members; eligible Admin/Member may edit. Private list hidden from ungranted members, including Admin. Reader can read, not save; Editor can edit if workspace role allows. Only creator grants access. Workspace Viewer remains read-only even with Editor grant. | LIST, AUTH |
| BC-LIST-007 | L | Submit invalid view configuration, foreign entry/list ID, stage, or overlong note. | Invalid choices rejected; Name column mandatory, columns unique/allowed, sort one of name/stage/newest, stage filter blank or supported. No cross-list/workspace mutation. | LIST |
| BC-VIEW-001 | P | Search loaded collection by company/contact/name/domain; filter missing email/domain or deal stage and sort counts/names. | Search ignores surrounding whitespace/case; filters retain matching records; numeric counts sort numerically. These are loaded authorized records, not a global database search or durable saved-list configuration. | VIEW |
| BC-VIEW-002 | L | Run pure record-view selection cases with fixed rows. | Search/filter/sort preserve expected IDs/order without mutating input. This proves selection logic only, not UI interaction or workspace authorization. | VIEW |

List entry/view writes do **not** have the record editor's version-conflict contract. Do not extend the 409 stale-record expectation to concurrent list edits. List deletion and grant-revocation UI are outside this slice.

## 7. Custom fields and configuration

Run required-field setup before any rows of that object type exist. Optional fields may be added later. Definitions and values are workspace/object-type scoped; definitions have stable field IDs.

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-FLD-001 | P | As Admin define fields for company/person/deal, including required unique Account code before companies exist. Compare Member/Viewer controls. | Admin alone defines fields. Member can edit values, Viewer can read only. Duplicate active field names ignoring case are rejected per object type. | FIELD |
| BC-FLD-002 | P | Create without required value; save a valid value; try clearing it or adding a late required field. | Missing/cleared required value is refused. Required definition after any rows of that type exist returns 409; no backfill is performed. Valid creation persists all values atomically with record. | FIELD, CRM |
| BC-FLD-003 | P | Exercise text, number (including 0), checkbox (including false), date, email, domain, URL and single select; reopen. | Correct values retain type. Email/domain lowercase; text trims. Checkbox false and numeric zero remain valid values, not mistaken for empty. Select accepts an exact saved option. | FIELD |
| BC-FLD-004 | P | Try invalid email/domain/date, unsupported select option, and duplicate unique text with changed case. | Invalid values are refused, unique collision returns 409, previous saved values remain intact. URL accepts HTTP(S) without embedded credentials. | FIELD |
| BC-FLD-005 | L | Exercise type/size boundaries and unsupported definitions. | Text max 500 characters; finite number absolute value ≤1 trillion; checkbox requires boolean; valid calendar date; select 2–30 case-insensitively distinct options. Reject unsupported field kind; enforce 32 active fields per object type. Definition kind/options/required/unique are not editable after creation. | FIELD |
| BC-FLD-006 | L | Save custom values with stale record version or wrong workspace/object field ID; repeat identical valid save. | Stale save returns 409; wrong field rejected. Changed values advance record version; no-op does not. UI conflict draft retention needs a separate UI observation. Custom-field change history is not implemented. | FIELD |
| BC-FLD-007 | L | Archive a field as Admin; read stored definition/value; attempt edit. | Stable ID and existing value remain visible; archived value cannot be edited. Member/Viewer cannot archive. | FIELD |

Custom fields are **not** saved-list columns/filters/sorts, report dimensions, or CSV-export fields. Currency, timestamp, phone, multi-select, ordered status, user reference and record reference custom kinds are not implemented.

## 8. CSV preview, import, idempotency and export

Supported transfer is Companies and People only. Import companies first; people require an already-saved, unambiguous company domain in the selected workspace. Manual records lacking identity are not guessed by name. “Idempotent” here means retrying identical data does not create duplicate identities or unnecessary updates—not a durable import-job/retry-key system.

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-CSV-001 | P | Map a small UTF-8 company file with one valid row, repeated domain and invalid domain; preview without import. | Preview gives row numbers/actions/counts/errors; repeated identity within file and malformed identity are row errors. Nothing is written. Bad/missing mapping is rejected. | CSV |
| BC-CSV-002 | P | Import previewed file without intervening changes, then reload and retry identical data. | Valid row saves once, invalid rows do not; completed response lists row action, known ID and error. Identical retry reports unchanged, not extra records. Overall HTTP success does not mean every row succeeded. | CSV |
| BC-CSV-003 | P | Exercise create-only, update-only and create-or-update with identical, changed and missing identities. | Create-only: identical existing unchanged, conflicting existing error. Update-only: missing match error, existing change updates. Upsert: creates missing, updates changed, identical unchanged. Unmapped description stays untouched; mapped blank description clears it. | CSV |
| BC-CSV-004 | P | Import person with uppercase email and saved company domain, retry, then preview a missing company. | Email normalized; retry unchanged. Missing company produces row error rather than auto-creating company. Relationship remains in selected workspace. | CSV |
| BC-CSV-005 | P | Export both record types; inspect file structure and small quote/comma/multiline text samples. | Workspace's active records only; Companies headers domain/name/description, People email/name/companyDomain. UTF-8 CSV quoting is valid; export excludes custom values, deals and tasks. | CSV |
| BC-CSV-006 | L | Export harmless formula-like text as inert file contents; inspect escaping without evaluating a spreadsheet formula. | Dangerous-looking leading formula text receives apostrophe and CSV quoting. Round-trip may retain apostrophe; do not assert byte-identical lossless round-trip. | CSV |
| BC-CSV-007 | P | With required fields defined for an imported object type, preview a creation then attempt import. | Preview is advisory and may show create; import returns 409 because it cannot supply required custom values. Existing-record updates and export remain supported. No partial creation occurs. | CSV, FIELD |
| BC-CSV-008 | L | Change records between preview/import, try ambiguous legacy identities, protected person reassignment and concurrent identical imports. | Import re-plans under workspace lock rather than trusting preview. Ambiguity/protected reassignment is a row error; concurrency does not duplicate identities. Accepted writes are transactional; validation errors may coexist with accepted rows. | CSV, CRM |
| BC-CSV-009 | L | Supply malformed quoting, invalid UTF-8, duplicate/blank headers, missing mapping, oversized file/row count and collection-capacity fixtures. | Clear refusal at file or row level as appropriate; file ≤10 MiB, ≤10000 data rows; active collection ≤500. No background job is invented, and no silent partial collection read is accepted. | CSV |
| BC-CSV-010 | P | As controlled Viewer, export/preview then attempt import; compare a separate tester workspace export. | Viewer may export and preview, not import. No other workspace's records are included. | CSV, AUTH |

Preview is not a reservation or guarantee: required custom fields and deal-protected person reassignment can cause import outcomes to differ, in addition to intervening edits. Preserve both preview and final row outcomes as evidence.

## 9. Merge, Trash and restore — local-only fixtures

All executable lifecycle scenarios here are L. Merge is irreversible; source is a redirect, not a restorable deleted duplicate. A 30-day restore window applies to ordinary soft deletion; expiration does not automatically purge stored rows.

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-LIFE-001 | L | Preview same-type merge of companies, people and deals; include differing attributes, custom values and overlapping list entries. | Review exposes differing choices and impact on links/notes/tasks/visible lists. Every conflict needs explicit source/target choice; missing choices rejected. Wrong/self targets refused. | LIFE |
| BC-LIFE-002 | L | Execute reviewed company/person merges. | Transaction moves source relationships, notes, tasks and memberships to survivor; overlapping list entry collapses to one using reviewed choice. No mismatched deal/company/person remains. Survivor-person company changes are blocked when its existing deals would be invalidated. | LIFE |
| BC-LIFE-003 | L | Execute reviewed deal merge; follow old source URL/resolve and inspect histories. | Old ID resolves to survivor within authorized workspace; source absent from active collections and cannot be restored. Source stage events stay under old deal ID and appear separately with survivor's timeline; lifecycle audit records actor/time/target. | LIFE, REPORT |
| BC-LIFE-004 | L | Change record/list entry, or add note/task after preview; then submit old preview. | 409 requires fresh review. No partial moves or unnoticed loss of newly attached note/task. | LIFE |
| BC-LIFE-005 | L | Include private list not editable by acting Admin/Member, then grant controlled Editor access and re-preview. | Merge initially refused without leaking private list name. Admin has no override. Authorized preview works after appropriate grant; Viewer still cannot preview/merge. | LIFE, LIST |
| BC-LIFE-006 | L | Trash independent company/person/deal fixtures with attached data. | Record disappears from active pages/collections, list display, CSV and reports; related notes/tasks/memberships retained but hidden with target. Audit records deletion and restore deadline. | LIFE, CRM, CSV, REPORT |
| BC-LIFE-007 | L | Try Trash with active linked people/deals or stale version; race company deletion against person creation/reassignment. | Dependent/stale deletion refused. Race cannot leave an active person under deleted company; at least one conflicting operation is refused. | LIFE, lifecycle script |
| BC-LIFE-008 | L | Restore ordinary deleted fixture in window; include notes/tasks/list membership. | Correct current version restores same identity/data and visibility, not a duplicate. Links must be active; deal's person must match company. Viewer/outsider cannot restore or inspect Trash. | LIFE |
| BC-LIFE-009 | L | Occupy deleted domain/email/unique custom value, or remove required active parent, before restore. | Restore returns 409 until conflict/dependency is resolved; no partial restore or identity takeover. | LIFE |
| BC-LIFE-010 | L | Backdate disposable deletion beyond 30 days; request restore and Trash listing. | Restore returns 410; expired row not in eligible Trash list, but database row is retained. Never manipulate clocks/timestamps in published data. | LIFE |

## 10. Signed-in roles and workspace access

These are ordinary authorization acceptance checks using only owned fixtures, not a comprehensive security audit.

| Stable ID | Lane | Practical action | Expected outcome | Sources |
| --- | --- | --- | --- | --- |
| BC-ACCESS-001 | P | Register a controlled account, sign out/in, reload; try one incorrect password. | Registration creates private workspace with creator Admin; sign-in restores access, incorrect password refused, sign-out ends current session. Anonymous CRM does not expose records. No credentials recorded as evidence. | AUTH |
| BC-ACCESS-002 | P | Admin adds controlled existing accounts as Member/Viewer; Member/Viewer attempt membership management through available controls. | Admin can manage roles; others cannot. Unregistered person must create account first—no invitation delivery. Acting Admin cannot demote self with this action. | AUTH |
| BC-ACCESS-003 | P | Compare Admin/Member/Viewer on same fictional records, notes, tasks, fields and lists. | Admin/Member can write ordinary records; Viewer reads but cannot create/edit/delete/import or persist views. Fields definitions remain Admin-only. Hidden controls alone are not proof of server enforcement; record what was actually observed. | AUTH, CRM, FIELD, LIST, CSV |
| BC-ACCESS-004 | P | Switch between two tester-owned workspaces and reload their known links. | Each selection displays only its own authorized data/configuration; stale loaded data does not flash as selected workspace content. A member's private list remains restricted even to another Admin. | AUTH, LIST, app/page.tsx |
| BC-ACCESS-005 | L | Assert anonymous denial and known-fixture cross-workspace read/write/history/restore denial across routes. | Anonymous protected reads/writes return 401; unjoined workspace or foreign records are not exposed; workspace Viewer writes return 403. Validate route-specific errors, including the documented person-create 404/409 discrepancy. | All route scripts |

## 11. Unavailable capabilities — NOT IMPLEMENTED

These are scope IDs, **not executable passing checks**. Reference screenshot controls or reusable design-pack components do not prove operational support. Basis: current route inventory, [workspace help](../../app/workspace-ui.tsx), and [README supported scope](../../README.md).

| Stable ID | Lane | Capability | Required catalogue status / boundary |
| --- | --- | --- | --- |
| BC-NI-001 | N | Connected email / email sync and sending | **NOT IMPLEMENTED**. Task notices are in-app only; a saved email address is not an email integration. |
| BC-NI-002 | N | Calendar sync / connected meetings | **NOT IMPLEMENTED**. Task due dates are manual dates, not calendar events. |
| BC-NI-003 | N | Sequences | **NOT IMPLEMENTED**. No scheduled multi-step outreach or sequence delivery claimed. |
| BC-NI-004 | N | Calls | **NOT IMPLEMENTED**. A task named “Call” does not implement dialling, call recording or call sync. |
| BC-NI-005 | N | Automation / workflow execution | **NOT IMPLEMENTED**. Lists, notes and tasks do not automatically send messages, hand off work or advance stages. |
| BC-NI-006 | N | AI assistant/actions | **NOT IMPLEMENTED**. No natural-language task generation, enrichment or autonomous action claimed. |

Other explicit exclusions: password recovery/email verification, invitations to unregistered accounts, bulk merge/restore, merge undo, large asynchronous imports, deal/task CSV transfer, advanced reporting and custom fields in views/reports/CSV. Their absence must not be relabeled as a successful manual workaround.

## Local regression planning and coverage gaps

Use pinned tool versions from [mise.toml](../../mise.toml) and follow [development instructions](../../README.md) plus [AGENTS.md](../../AGENTS.md). **Do not execute as part of writing this catalogue.** Before any later fixture run, verify the effective database destination, including an exported `DATABASE_URL` overriding `.env.local`. Never print its value or copy credentials into results. The scripts require a database but do not themselves enforce a local-only host guard.

The eight database-backed scripts import route handlers directly and construct Requests; they do **not** run against the published HTTP service and do not prove browser interaction. They register fixtures, some directly insert/update database rows, and perform SQL deletion cleanup in `finally`. Review cleanup scope and preserve unrelated data; use disposable local development data, not customer records. Run suites independently and retain each exit status so an early assertion does not erase later coverage.

| Existing file | Catalogue groups it helps cover | Important limit |
| --- | --- | --- |
| `scripts/check-crm-api.ts` | ACCESS, REL, basic DEAL/TASK/NOTE | Known source-level 404/409 disagreement; a failure stops later assertions in this file. |
| `scripts/check-record-edits.ts` | ID races, REL, NOTE, attribute history | Server versions/history, not browser conflict recovery. |
| `scripts/check-productivity.ts` | TASK assignment, notice privacy, stale saves/deletion | Does not fully exercise browser date buckets or My/Team rendering. |
| `scripts/check-reports-api.ts` | DEAL transitions, RPT currencies/drilldowns/time-zone boundaries | Fixed-clock helper assertions plus route tests, not published UI. |
| `scripts/check-lists-api.ts` | LIST independence, duplicates, grants, saved settings/removal | Does not establish browser Save/Discard or URL-refresh behavior. |
| `scripts/check-custom-fields.ts` | FLD types, required/unique, version, archive; CSV required-field restriction | Some extreme size/count/type boundaries above need added focused assertions. |
| `scripts/check-csv-api.ts` | CSV mapping, errors, retries, formula escaping, duplicate fixtures/access | Sequential retries exist; concurrent-import scenario and all volume boundaries need focused coverage. |
| `scripts/check-record-lifecycle.ts` | LIFE merges, redirects, Trash/restore, races, audit | Includes direct backdating/SQL cleanup; not all custom-field collision and parent-restore cases above are asserted. |
| `shared/record-views.test.ts` | VIEW search/filter/numeric sort/immutability | Pure unit tests; no database, authorization, or UI proof. |

Not every catalogue row already has a complete automated test. Published UI checks, conflict draft retention, valid/invalid input matrices, and any gaps listed above remain planned manual/local additions. Do not state “all business logic covered” after running just these files. Type checking/build success can supplement this catalogue but cannot replace its business assertions.

## Recording a later execution

Keep this catalogue as the expectation baseline. Create a **separate** result record, keyed by these IDs, only when work is authorized and performed. For each check capture:

- Run label, deployed revision or local commit, timestamp and time zone, lane, UI/HTTP/route/unit method, and fixture labels/IDs without credentials.
- Actual action/result, before-and-after values, refresh/reopen observation, relevant sanitized row outcomes/history or HTTP status, and optional screenshot references.
- Status: **NOT RUN**, **PASS**, **FAIL**, or **BLOCKED**; keep **NOT IMPLEMENTED** for N entries. If part of a row was not exercised, say so instead of marking the whole row passed.
- Exact failure text and business effect, any prerequisite blocking dependent IDs, and whether cleanup completed or fictional fixtures remain. Stopped script assertions are NOT RUN, not implied passes.

Report P and L coverage separately and distinguish UI from HTTP results. Exclude N entries from executable pass rates, but show them prominently. A published-site HTTP success must not conceal a failed navigation or unsaved UI stage change. No results, deployments, data modifications, test executions or screenshots are claimed by this catalogue.
