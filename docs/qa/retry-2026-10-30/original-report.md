# Published business-check results

**Result: incomplete—not all green and not a full-suite pass.** The latest evidence records **22 PASS, 0 FAIL, 17 BLOCKED, 35 NOT_RUN and 6 NOT_IMPLEMENTED across 80 catalogue IDs**. Zero new confirmed business failures does **not** resolve the earlier local regression or browser issues.

## Scope and evidence

- **Baseline:** [business-check catalogue](business-check-catalogue.md). Its “NOT RUN” wording describes the pre-execution baseline; the separate [sanitized results JSON](published-business-check-results.json) holds the latest per-ID outcomes, request evidence and recovery history.
- **Run:** `Business QA — HTTP 2026-10-29T13:15:50.672Z`, on 29 October 2026, UTC. Initial execution: 13:15:50–13:23:28; targeted CSV continuation completed at 13:28:12.
- **Method:** published HTTPS business-rule checks, **not browser/visual signoff**. No application code was imported, no database was accessed directly, and no local regression suite was executed in this run. Deployed revision was not queried and remains unknown.
- **Review fixtures:** [published QA workspace](https://attio-clone-staging-qjs5-bibeinudna-uc.a.run.app/?workspace=92346c65-b169-44e0-a8d1-abae79382b8a) and [Fields QA workspace](https://attio-clone-staging-qjs5-bibeinudna-uc.a.run.app/?workspace=5b64003d-35e2-4445-aae4-55b174a9b043). Access requires an authorized signed-in account; no credentials are included here.

### What the numbers mean

| Measure | Latest result |
| --- | ---: |
| Catalogue IDs | 80 |
| Executable IDs (excluding unavailable capabilities) | 74 |
| Attempted IDs (PASS + BLOCKED + FAIL) | 39 |
| Fully evaluated IDs (PASS + FAIL) | 22 |
| Pass rate **only among fully evaluated IDs** | **22/22 = 100%** |
| Catalogue execution coverage, measured by fully evaluated executable IDs | **22/74 = 29.7%** |

The 100% figure excludes blocked, not-run and unavailable cases. It is **not** an overall CRM pass rate. There were 348 recorded requests, including 16 setup requests excluded from business totals; request counts are not test-case counts.

## Business areas that passed

These summaries follow the actual per-ID results, not earlier workflow claims. Request numbers below refer to `requests[].requestId` in the evidence JSON; each result also lists its own `httpEvidence`.

| Area and PASS IDs | Evidenced business result | Request references |
| --- | --- | --- |
| Company/person identity: **BC-ID-001–005** | Names and identities normalized; duplicate company domains and person emails rejected on create/edit; invalid inputs refused and corrections saved; optional identities supported; same fictional identities remained independent in two owned QA workspaces. | 5–32; 314–316 |
| Relationships and edits: **BC-REL-003, BC-REL-005** | Reassignment without deals saved; reassignment with deals was refused. Ordinary edits persisted with actor/time and old/new attribute history; identical saves did not add history or versions. | 42–72 |
| Closing and deal validation: **BC-DEAL-003, BC-DEAL-004, BC-DEAL-006** | Won/reopen/re-win updated current close time and monthly contribution while retaining events; leaving Lost cleared the current reason but retained history. Unchanged saves added no event/version. Invalid stages, currencies and minor-unit values were refused without history side effects. | 93–106; 132–140 |
| Reporting: **BC-RPT-001** | Open totals excluded Won/Lost; USD monthly wins increased by 100.00; EUR open value stayed 200.00; GBP/INR stayed separate, with no mixed-currency grand total. | 141–154 |
| Notes: **BC-NOTE-002** | Empty, whitespace and oversized notes were refused; an unchanged save added no history/version. | 197–204 |
| Independent processes: **BC-LIST-001** | Company and deal entries changed independently across two lists without changing canonical record details or the deal pipeline stage. | 212–229 |
| Configuration: **BC-FLD-002–004** | Required-field creation/clearing rules held; late required definitions were refused. Supported field types retained their values, including zero and false; invalid values and case-insensitive unique collisions were rejected without losing saved values. | 293–308 |
| CSV: **BC-CSV-001–005, BC-CSV-007** | Preview did not write records; valid rows imported while bad rows reported errors; identical retry did not duplicate records. Create/update/upsert and person-company matching behaved as specified. Both exports parsed with correct schemas and escaped text. Required custom fields prevented CSV creation without partial records while updates/export worked. | 258–280; 309–313; continuation 339–348 (see per-ID mappings) |

These are manual CRM building blocks—not automated qualification, onboarding, renewal or outreach engines. No browser interaction is implied by these HTTP passes.

## BLOCKED: partial evidence, not an environment outage

All **17 BLOCKED** rows had passing selected HTTP assertions, but their **whole catalogue scenario was not fully evaluated**. The missing browser observations, additional controlled accounts or broader scenario steps below are coverage gaps—not evidence of a failed business rule, a credential failure or a service/database outage.

| BLOCKED ID | What remains unverified |
| --- | --- |
| BC-REL-001 | Rendered linked-record pages and collection relationship counts. |
| BC-REL-002 | Editor clearing/filtering of the person selector after changing company. |
| BC-DEAL-001 | Agreement between browser board, table and record detail after stage changes. |
| BC-DEAL-002 | Browser Cancel behavior; HTTP loss-reason checks passed. |
| BC-DEAL-005 | Displayed decimal units; API minor-unit precision passed. |
| BC-RPT-002 | Viewer access and browser reporting-month/time-zone display. |
| BC-TASK-001 | Agreement between record and Tasks pages after edits/completion/reopening. |
| BC-TASK-002 | Browser-local Overdue/Today/Upcoming/No due date buckets; UTC report checks passed. |
| BC-TASK-003 | Assignment to another controlled member and My/Team/Home rendering. |
| BC-NOTE-001 | Notes index and escaped plain-text rendering. |
| BC-NOTE-003 | Editor draft retention and “Load latest version” flow; sequential HTTP stale-version/refreshed retry passed. |
| BC-LIST-002 | Omission of existing records from browser add choices; HTTP duplicate refusal passed. |
| BC-LIST-003 | Unsaved labels, Discard, browser reopen and Name-column behavior. |
| BC-LIST-005 | Browser confirmation explaining that removing an entry retains the record. |
| BC-FLD-001 | Member/Viewer definition/value controls; Admin setup and duplicate-name checks passed. |
| BC-LIFE-006 | Only reversible company Trash slice checked; person/deal deletion, browser visibility and complete audit/deadline checks missing. |
| BC-LIFE-008 | Same company identity, notes, task and list membership restored; person/deal dependency and Viewer/outsider cases missing. |

### Catalogue lanes versus actual execution

The catalogue labels **P** as published checks, **L** as local-only scenarios and **N** as unavailable. Actual execution here was HTTP throughout:

| Catalogue lane | PASS | FAIL | BLOCKED | NOT_RUN | NOT_IMPLEMENTED |
| --- | ---: | ---: | ---: | ---: | ---: |
| P | 21 | 0 | 14 | 10 | 0 |
| L | 1 | 0 | 3 | 25 | 0 |
| N | 0 | 0 | 0 | 0 | 6 |

Four L-labelled IDs received published HTTP coverage: BC-DEAL-006 passed; BC-NOTE-003, BC-LIFE-006 and BC-LIFE-008 remained partial/blocked. The evidence explicitly records a reversible company-only lifecycle override; it does not establish execution of the full local-only scenarios. No merge, destructive cleanup, concurrency/load test or timestamp manipulation was performed.

## CSV runner errors and targeted recovery

The original runner exited **1**, recording raw totals of **20 PASS and 2 FAIL** alongside the unchanged blocked/not-run/unavailable totals. Those two errors were incorrect runner format assumptions, not established CRM business failures:

- **BC-CSV-002:** `assert.ok(saved.outcomes[1].error&&saved.outcomes[2].error)` assumed an `error` property. Actual row errors used `action=error` with a nonempty `message`. The assertion interrupted the identical-file retry.
- **BC-CSV-005:** `assert.ok(companies.startsWith('domain,name,description'))` assumed unquoted headers. The actual quoted headers were valid CSV; the assertion interrupted the People export check.

Both initially remained incomplete/BLOCKED on review. **Only these two scenarios** were continued, finishing with exit code **0**. The retry returned unchanged company ID 7 plus two expected row errors without creating/changing records on retry. An independent Python standard CSV parser verified both exports (6 companies, 4 people), exact three-column schemas, linked company domains and comma/quote/multiline samples. Preparing and restoring the previously edited fixture caused two expected version/history advances; no new records were created.

Both IDs are now PASS **without changing business expectations**. Original errors remain preserved in `runnerError`, `rawRunnerTotals`, `execution`, `adjudications` and `csvContinuation` in the JSON. The recovery does not convert unrelated blocked or not-run rows into passes.

## Prior issues remain open—not retested

- **Prior local 409/404 regression:** the earlier local CRM check reported `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 409 !== 404` at [scripts/check-crm-api.ts:57](../../scripts/check-crm-api.ts#L57). The check expects 404 for a cross-workspace company link on person creation; the [current route](../../app/api/crm/route.ts#L86) throws 409, “The linked company changed. Review the person and try again.” This is a known response-contract mismatch, **not retested or resolved** here. Assertions after the earlier stopping failure were not established by that script run. BC-REL-004 and BC-ACCESS-005 remain NOT_RUN in this evidence.
- **Prior browser findings:** attempts to navigate to Reports and change the onboarding stage did not visibly complete. They were **not retested or resolved** by this HTTP run; neither visual correctness nor full browser workflow completion is signed off.

Zero latest FAIL means no confirmed new business failure among the fully evaluated IDs—not that prior issues have disappeared. Next verification should address these issues, complete blocked browser/role scenarios, and separately run the remaining local-only checks against verified disposable local fixtures.

## Compact status appendix: all remaining IDs

The PASS and BLOCKED tables above identify all 39 attempted IDs. Every other ID is listed below. Inclusive ranges mean every numbered ID between the endpoints; prefixes are unchanged.

| Status | IDs | Count / scope |
| --- | --- | --- |
| NOT_RUN | BC-ID-006–007; BC-REL-004, BC-REL-006; BC-RPT-003; BC-TASK-006–007; BC-NOTE-004; BC-LIST-007; BC-VIEW-002; BC-FLD-005–007; BC-CSV-006, BC-CSV-008–009; BC-LIFE-001–005, BC-LIFE-007, BC-LIFE-009–010; BC-ACCESS-005 | **25** local-reserved scenarios: races, boundaries, lifecycle, version/access checks or pure selection tests. Not executed locally in this run. |
| NOT_RUN | BC-TASK-004–005; BC-LIST-004, BC-LIST-006; BC-VIEW-001; BC-CSV-010; BC-ACCESS-001–004 | **10** unselected browser, additional-account or broader scenarios. Setup login is not a full BC-ACCESS-001 pass. |
| NOT_IMPLEMENTED | BC-NI-001 (connected email); BC-NI-002 (calendar sync); BC-NI-003 (sequences); BC-NI-004 (calls); BC-NI-005 (automation/workflow execution); BC-NI-006 (AI actions) | **6** unavailable capabilities, excluded from executable denominators—not passes or environment blockers. |
| FAIL | None in the latest adjudicated results | **0**; prior issues above remain open. |

## Data safety and retained fixtures

According to the recorded boundaries, **customer data was untouched**: record reads/writes used only the two fresh fictional QA workspaces; no customer record IDs were used. Fictional fixtures remain available for review: 7 companies, 5 people, 5 deals, 4 notes, 6 tasks, 4 lists and 10 custom fields across those workspaces. The test company was restored after the reversible Trash check; test-created list entries alone were removed/re-added. No hard deletion, merge execution, SQL cleanup, emails or integrations occurred.

This report was produced by reading the existing catalogue, sanitized evidence and relevant source references. **No tests were executed, source code edited, deployment made or live data changed to create this report.** Markdown is the requested deliverable; no PDF was created.
