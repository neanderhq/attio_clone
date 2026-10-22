# Project setup

This is a Next.js CRM in `app/`, with database code in `server/`, shared types in `shared/`, and migrations in `drizzle/`. Read `README.md` for product scope and the local PostgreSQL configuration. CRM records require a signed-in workspace member. Seeded demo data must be fictional and assigned to an explicit separate workspace.

## Development setup

Use the Node and pnpm versions in `mise.toml`. From the repository root, `pnpm install --frozen-lockfile` installs dependencies. The existing `compose.dev.yaml` provides local PostgreSQL; follow the database startup and migration instructions in `README.md` before opening the CRM. Do not migrate a database unless it is confirmed to be a development database.

The existing package entry points are `pnpm dev` for the browser preview, `pnpm check` for TypeScript, and `pnpm build` for a production build. `pnpm seed` optionally adds fictional demo records. The app uses `DATABASE_URL` from gitignored `.env.local` for database access; never commit real credentials. Run Compose with an explicit unique `-p` and `-f` as described in `README.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
