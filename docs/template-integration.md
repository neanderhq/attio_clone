# Neander template integration

Current release process: this MIT-licensed application runs app checks and builds
in its own CI. Neander maintainers manually verify and publish template releases
from private CI; contributors need no private workflow or publishing credentials.
The workflow pins and publication runs below describe the original onboarding.
See the repository README for current local setup and contributor instructions.


The library entry is **Customer CRM**, ID `attio`. It uses the normal Next.js +
PostgreSQL publishing recipe in `.neander/compose.yaml`. The template manifest
adds catalog metadata, a real app screenshot, and install/check/test/seed/smoke
commands. Source and seed code stay in this GitHub repository at the release
commit; no source archive is uploaded.

## Sample data and account ownership

After migration, `pnpm template:seed` enables the versioned fictional starter
scenario in `crm_template_settings`. It creates no user, password, session, or
membership and does not assign existing records to anyone. The app retains its
normal account-creation and sign-in flow.

When an account or another workspace is created, that existing transaction adds
three fictional companies, people, deals, notes and tasks to the **new private
workspace**. Tasks belong to the creating user. Existing workspaces remain
unchanged. Every CRM request still requires a signed-in workspace member.
The user sees populated CRM data after creating their account; product-to-app
owner identity handoff is part of the separate provisioning integration.

A `crm_workspace_seeds` receipt makes repeated initialization a no-op for an
already seeded workspace, including after renaming or deleting sample records.
The transaction and workspace lock also prevent partial or concurrent duplicate
seeds. The existing explicit `DEMO_WORKSPACE_ID=... pnpm seed` command uses this
same retryable seed for a confirmed fictional-data workspace. It requires an
existing workspace and refuses initial seeding when required custom fields exist.

An operator can disable sample initialization for future workspaces by setting
`crm_template_settings.enabled=false` for `attio-starter-v1`. Re-running the
template seed preserves that decision. This does not remove samples already
created in existing workspaces. Ordinary application migration alone leaves
sample initialization off until the template seed is explicitly run.

## Verification and CI

The reusable workflow is pinned to
`neanderhq/neander_backend/.github/workflows/template-contract.yml@ba9d725d63a377b142e15d26c6d50f2041cf063d`.
It selects Node `24.22.0`, the repository-pinned pnpm, and disposable PostgreSQL.
The shared workflow's installer remains pinned to
`620f1f00f9cd3509bd0920e74a19055826581ea4`.

The shared verifier checks types and publishing examples, builds the normal
Linux/amd64 image, runs Publish's migration helper, initializes the template and
runs `pnpm test:template` against that exact image. The smoke check preserves the
former CI's literal-secret, HTTP route and JS-asset checks, runs the existing
CRM authentication/role regression, and verifies seeded signup, workspace
isolation, stored edits/deletion, retry behavior, and container replacement.

Run locally against **only a disposable test database**:

```sh
neander-template check . --json
NEANDER_TEMPLATE_TEST_DATABASE_URL=postgresql://USER:PASS@127.0.0.1:PORT/TEST_DB \
  NEANDER_TEMPLATE_TEST_ORIGIN=http://127.0.0.1:8080 \
  neander-template verify . --json
```

The smoke test changes the initialization flag in that test database while
checking opt-out behavior and creates/deletes its own accounts and workspaces.
It cleans up its app containers. The caller owns and removes the disposable
database. Keep generated verification reports outside committed source.

`.neander/thumbnail.png` is a browser screenshot of the real seeded Deals board.
Refresh it from the app when the product UI or sample scenario changes.

## Publication setup

PRs verify without uploading releases. After onboarding access is applied, a
successful `main` push publishes tested image digests to
`us-central1-docker.pkg.dev/prod-deploy-agent/neander-templates`, writes a private
release record and `library/catalog/attio.json` in
`gs://neander-template-artifacts-1023301904719`, and uploads the public thumbnail
to `gs://neander-template-assets-1023301904719/library/`.

The six `TEMPLATE_*` organization Actions variables must select this repository,
private workflow sharing must be enabled, and numeric repository ID `1444195676`
must be permitted in the shared GCP Workload Identity Federation configuration.
The workflow never deploys a user's application. Code readiness and verification
are separate from a successful `main` publication and catalog registration.
