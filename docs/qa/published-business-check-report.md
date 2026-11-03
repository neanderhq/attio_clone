# Business-check retry results — 30 October 2026

All 35 previously NOT_RUN scenarios now have dispositions: **32/35 executed on retry: 25 PASS, 2 FAIL, 5 incomplete/BLOCKED; 3 still NOT_RUN (browser-only)**. No source changes, migrations or deployment.

Current catalogue totals: **47 PASS, 2 FAIL, 22 BLOCKED, 3 NOT_RUN, 6 NOT_IMPLEMENTED** (80 IDs; 74 executable). Original 22 PASS statuses and all 348 original request records are preserved.

The original skipped group was **35 total, not 25**: 25 local-reserved scenarios plus 10 published-lane controlled-account/browser scenarios. Of those 10, seven needed controlled accounts or broader role coverage, and three needed browser-only observations. Exact original reason strings and counts are in [retry-summary.json](retry-2026-10-30/retry-summary.json).

This is mixed evidence: published HTTPS checks used fresh fictional isolated fixtures; races, SQL/backdating, oversized boundaries and irreversible merges ran only against confirmed local PostgreSQL at 127.0.0.1:55433/neander_dev. **Local execution is not published proof.** Deployed revision unknown; local commit `0d1f8fae927421f18250092e80074065a7a5c593`. No external communications, customer data changes, exploit probes or third-party testing.

## Failures and incomplete work

BC-REL-004 and BC-ACCESS-005 reproduce the same known local defect, not two distinct defects: person creation using a controlled company from another workspace returned **409 instead of expected 404**, with “The linked company changed. Review the person and try again.” The write was refused and linked collections stayed unchanged. The original CRM script stops at line 57; independent suites and focused assertions continued. No fix was made.

Eight retried IDs remain incomplete for parent browser tools: BC-LIST-004, BC-VIEW-001, BC-ACCESS-001, BC-ACCESS-002, BC-ACCESS-003, BC-ACCESS-004, BC-FLD-006 and BC-LIFE-003. Their selected server assertions do not establish browser navigation, reload, role controls, conflict draft retention, old URL navigation or separate timeline rendering. The other 17 originally BLOCKED scenarios were preserved; earlier Reports/onboarding navigation findings remain unresolved.

## Every original NOT_RUN ID

| ID | Lane | Disposition | Actual environment | Evidence / remaining limitation |
| --- | --- | --- | --- | --- |
| BC-ID-006 | L | PASS | local-development | Competing company domain creates/edits and person email edits produced one success and one 409; active canonical identities did not duplicate. |
| BC-ID-007 | L | PASS | local-development | Scoped SQL created legacy duplicate company domains and person emails; actual imports returned ambiguity row errors without selecting or changing a candidate. |
| BC-REL-004 | L | FAIL | local-development | Foreign/mismatched company/person/deal/note/task operations refused; before/after linked collections unchanged. Person-create response contract fails: expected 404; actual 409, “The linked company changed. Review the person and try again.” |
| BC-REL-006 | L | PASS | local-development | Company and deal stale versions returned 409, retained the winner, and fresh reviewed retries saved. Existing suite also exercised simultaneous competing company edits. |
| BC-RPT-003 | L | PASS | local-development | Fixed clocks exercised UTC, America/Los_Angeles and Asia/Kolkata month/day boundaries. SQL legacy Won with null close time was counted as unknown and excluded from monthly wins; invalid time zone returned 400. |
| BC-TASK-004 | P | PASS | published-https | All specified HTTP outcomes passed. |
| BC-TASK-005 | P | PASS | published-https | All specified HTTP outcomes passed. |
| BC-TASK-006 | L | PASS | local-development | Impossible date and non-boolean completion returned 400; foreign assignee/target returned 404 with task unchanged. Simultaneous same-version edits returned one 200 and one 409, preserving winner fields. |
| BC-TASK-007 | L | PASS | local-development | Stale task DELETE returned 409 and preserved task; current DELETE returned 200 and assignment notice disappeared from recipient inbox. |
| BC-NOTE-004 | L | PASS | local-development | Edited note survived old-version DELETE 409; current-version DELETE 200 removed it. Record Trash was not used. |
| BC-LIST-004 | P | NOT_RUN | published-browser-not-executed | List URL refresh and workspace switching require parent browser tools. |
| BC-LIST-006 | P | PASS | published-https | Full ordinary HTTP list role matrix passed on fresh controlled fixtures in continuation. Original temporary runner omitted owner email; correct 400 “Enter a valid email.” was a harness error, preserved in prior retry evidence. |
| BC-LIST-007 | L | PASS | local-development | Missing Name, duplicate/unsupported columns, unsupported sort/filter/stage, note length 501, foreign list/workspace and other-list entry IDs were refused; saved entries/views remained unchanged. |
| BC-VIEW-001 | P | NOT_RUN | published-browser-not-executed | Search/filter/sort rendered controls require parent browser tools; local pure selection tests cannot pass this row. |
| BC-VIEW-002 | L | PASS | local-development | All three pure tests passed: case/whitespace and relationship search, field/stage filters, numeric sorts, expected ID order and source immutability. No UI or authorization proof claimed. |
| BC-FLD-005 | L | PASS | local-development | Exact validator boundaries passed: text 500/501, finite numbers at ±1 trillion and rejection beyond/nonfinite, strict boolean, real calendar date, select 2/30 versus 0/1/31 and case duplicates. Route refused unsupported definitions and definition updates, preserved original rules, allowed 32 active definitions and refused the 33rd with 409. |
| BC-FLD-006 | L | BLOCKED | local-development | Server evidence passed: changed custom value advanced version; stale returned 409; wrong object/foreign field returned 404; identical save retained version. Browser draft retention was not exercised. |
| BC-FLD-007 | L | PASS | local-development | Member and Viewer archive returned 403; Admin archive 200 retained stable definition ID and saved value; editing archived value returned 404. |
| BC-CSV-006 | L | PASS | local-development | Local export apostrophe-escaped inert formula-like text with CSV quoting; parser verified rows and prefixes. No spreadsheet formulas evaluated; no byte-identical round-trip claimed. |
| BC-CSV-008 | L | PASS | local-development | Import replanned create preview to update after intervening creation. Actual ambiguous domain/email imports reported row errors. Protected person reassignment previewed update but import reported error without moving the person. Two identical concurrent imports returned create/unchanged and exactly one identity. Existing CSV suite verified mixed accepted/error rows. |
| BC-CSV-009 | L | PASS | local-development | Malformed quote, invalid UTF-8, blank/duplicate headers and missing mapping returned 400. Exactly 10 MiB accepted for preview; +1 byte returned 413. 10000 rows accepted; 10001 rejected. At 499 companies a two-row import created one and refused the next; 500 blocked further creates, and a scoped legacy 501st SQL fixture made CRM reads/CSV preview return 409 rather than a partial collection. Initial runner wrongly expected validation of an unmapped description; corrected continuation completed every remaining assertion. |
| BC-CSV-010 | P | PASS | published-https | All specified HTTP outcomes passed. |
| BC-LIFE-001 | L | PASS | local-development | Company/person/deal previews exposed differing ordinary/custom fields and notes/tasks; company preview included links and overlapping list conflict. Missing choices, self and absent targets refused. No browser review controls observed. |
| BC-LIFE-002 | L | PASS | local-development | Local reviewed company/person merges moved relationships, notes, tasks and list memberships; overlapping company entry collapsed using chosen source note. Person survivor-company change that would invalidate existing deals returned 409 with links unchanged. |
| BC-LIFE-003 | L | BLOCKED | local-development | Deal old-ID resolve returned survivor; source absent active and restore returned 404. Source stage rows remained under old ID in SQL and separate mergedEvents; audit included actor, time and target. Browser URL redirect and separate timeline rendering remain unobserved. |
| BC-LIFE-004 | L | PASS | local-development | After-preview list entry, record name, new note and new task changes all invalidated old merge with 409; source stayed active and attached data was preserved until fresh reviewed merge. |
| BC-LIFE-005 | L | PASS | local-development | Owned Member private list blocked Admin merge preview without disclosing its name; Member creator Editor grant enabled fresh preview/merge. Viewer preview/merge-route access returned 403; no Admin override. |
| BC-LIFE-007 | L | PASS | local-development | Dependent and stale deletion returned 409. Local controlled delete/create and delete/reassignment races refused at least one operation; SQL found zero active people under deleted companies. |
| BC-LIFE-009 | L | PASS | local-development | Domain, email and unique custom collisions returned restore 409 until resolved. Inactive parent and inactive/mismatched deal person returned 409; repairing/restoring parents allowed same-identity restore. Failed unique restore left record in Trash. |
| BC-LIFE-010 | L | PASS | local-development | Only disposable local company deletion was backdated 31 days: restore 410, absent eligible Trash, row still present in database before scoped cleanup. |
| BC-ACCESS-001 | P | BLOCKED | published-https | Selected HTTP assertions passed; full scenario incomplete. |
| BC-ACCESS-002 | P | BLOCKED | published-https | Selected HTTP assertions passed; full scenario incomplete. |
| BC-ACCESS-003 | P | BLOCKED | published-https | Selected HTTP assertions passed; full scenario incomplete. |
| BC-ACCESS-004 | P | NOT_RUN | published-browser-not-executed | Workspace selection, reload and stale-content flash require parent browser tools. |
| BC-ACCESS-005 | L | FAIL | local-development | Ordinary owned-fixture anonymous/unjoined/foreign-route and Viewer checks ran across suites. The known person-create contract failed: expected 404, actual 409, “The linked company changed. Review the person and try again.” The original CRM suite stopped at line 57; later suites/focused checks ran independently. No adversarial workflow or exploit probe performed. |

## Exact assertion mapping

The [structured summary](retry-2026-10-30/retry-summary.json) records exact commands, exit codes, outputs, per-ID evidence and original reasons. Focused files record individual assertions, sanitized synthetic Requests, scoped SQL and verified cleanup. Every local assertion below is local proof only.

| Suite | Relevant reached assertions |
| --- | --- |
| check-record-edits.ts | Company concurrent edits 200/409, domain edit/create races, person email race; deal/note stale saves, history, Viewer denials. Fresh retries/current note deletion added in focused-core.json. |
| check-productivity.ts | Assignment/no-op/self/back-assignment notice counts; recipient read twice and Viewer read; competing task saves 200/409; stale/current deletion. Notification disappearance added in focused-core.json. |
| check-reports-api.ts | Invalid zone 400 and fixed clock month/day boundaries; focused-core.json adds SQL legacy Won null close date and disclosure. |
| check-csv-api.ts | Formula escaping and parsing, malformed/UTF8/oversize/mapping, duplicate identity previews, Viewer export/import denial. Actual ambiguous imports, replan, concurrent imports and exact size/row/capacity edges added in focused CSV artifacts. |
| check-lists-api.ts | Private/shared roles/grants, unique and independent entries, saved settings and removal. Invalid view schema/stage/note/scope assertions added in focused-fields-lists.json. |
| check-custom-fields.ts | Required/typed/unique values, object scope, stale/no-op saves, archive/value retention and roles. Extreme validator/definition/active-count edges and Member archive denial added in focused-fields-lists.json. |
| check-record-lifecycle.ts | Company/person/deal merges, overlap resolution, survivor-deal protection, changed list/new attachments 409, private-list grant, domain/email restore collision, expiration and controlled deletion races. Focused lifecycle assertions add custom conflicts, record-edit invalidation, person attachments, source event storage/audit fields, unique/parent restore and expired-row retention. |
| shared/record-views.test.ts | Three passed pure search/filter/numeric-sort/immutability tests. Does not pass BC-VIEW-001 browser interactions. |
| check-crm-api.ts | Fails at first foreign-company person create (line 57), actual 409 vs expected 404. Later assertions in this script remain unexecuted, with separate focused coverage documented rather than inferred. |

## Runner corrections and fixtures

A list retry initially omitted the demo owner email; the correct “Enter a valid email.” 400 exposed a runner error. A full fresh-fixture continuation passed. The first focused CSV size assertion wrongly expected an unmapped description to be validated; a corrected full-row continuation passed all remaining boundaries. Original failed attempts and their command exits are retained; neither is reported as a product failure.

Published: six new fictional workspaces, four controlled accounts, 14 CRM records, four lists, one field and three notices retained. Exact IDs and labels are in sanitized published request/fixture evidence. Generated controlled-account secrets were discarded and are not in evidence. The authorized demo Admin can access the two new QA workspaces; four controlled accounts have separate private home workspaces. Original QA fixtures remain unchanged.

Local: all focused fixture users/workspaces were deleted after assertions, including failed assertions; per-run absence checks passed. Final cleanup audit is in cleanup-audit.json. No migration was run.

The [original report](retry-2026-10-30/original-report.md) and [original results](retry-2026-10-30/original-results.json) remain as historical evidence. The catalogue was not edited: SHA-256 `5d4db365a8a795e69d0e0ad63ea833d99a52fe0c46b5368848400f89019e1d7d`. Request history is appended in [current results](published-business-check-results.json). The top-level original run metadata remains historical; retry metadata identifies each new environment.

Three wholly unexecuted browser IDs retain NOT_RUN: BC-LIST-004, BC-VIEW-001 and BC-ACCESS-004. These are included in the eight browser-pending IDs; changing their disposition does not claim a browser execution. The other five pending rows have partial executed server evidence.

Parent browser retry after delegated retry completion: `browser_status` confirmed the existing published tab. `browser_snapshot`, then `browser_open`, each failed with the verbatim error “Sidecar event stream disconnected before desktop tool completion.” Browser verification could not proceed; no browser checks ran, no remaining rows were converted to PASS, and totals remain **47 PASS, 2 FAIL, 22 BLOCKED, 3 NOT_RUN, 6 NOT_IMPLEMENTED** across 80 IDs. No application edits or deployment changes were made.