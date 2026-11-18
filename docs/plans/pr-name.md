# Proposed PR name and description

**Title:** Build workspace-scoped CRM foundation and safeguard record merges  
**Suggested base:** `main`  
**Suggested head:** `feature/crm-workspace`

## Suggested description

Folio's current foundation includes local sign-in with workspace membership and roles, linked Companies/People/Deals, notes and assigned tasks, private/shared lists with saved views, synchronous Companies/People CSV transfer, and current pipeline reports. It also has reviewed same-type merges and 30-day restore eligibility. See [README.md](../../README.md) for the supported scope and limits.

**This branch's change relative to local `main` is narrower:** it safeguards Person merges against silently moving the survivor's existing deals, rejects a merge when linked notes or tasks changed since its preview, protects Person writes during concurrent Company deletion, and avoids showing a previous workspace's records during a switch. The focused lifecycle check is in [scripts/check-record-lifecycle.ts](../../scripts/check-record-lifecycle.ts). The foundation above is context, not a claim that this branch introduced it.

**Not full spec:** P0 remains partial, including invitations, full typed attributes, configurable grids, real-time collaboration, and asynchronous imports. P1/P2 integrations, automation, and AI remain pending. This description does not claim full-spec acceptance or that a PR has been opened.
